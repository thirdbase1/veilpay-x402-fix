'use client'

import { midnightPublicConfig } from '@/lib/config'

/**
 * Detection and connection for injected Midnight wallet extensions.
 *
 * Implements the official DApp Connector API (v4) as defined by
 * @midnight-ntwrk/dapp-connector-api:
 *
 * Wallets inject an InitialAPI under `window.midnight.<uuid>`:
 *   {
 *     rdns: string        // reverse-DNS wallet identifier, e.g. "io.lace.midnight"
 *     name: string        // display name
 *     icon: string        // wallet icon URL (hosted or data URL)
 *     apiVersion: string  // e.g. "4.0.1"
 *     connect(networkId): Promise<ConnectedAPI>   // networkId: 'mainnet' | 'preview' | 'preprod' | 'undeployed'
 *   }
 *
 * ConnectedAPI (the relevant subset):
 *   getUnshieldedAddress(): Promise<{ unshieldedAddress: string }>
 *   getShieldedAddresses(): Promise<{ shieldedAddress: string, ... }>
 *   makeTransfer(outputs: DesiredOutput[]): Promise<{ tx: string }>
 *   submitTransaction(tx: string): Promise<void>
 *
 * Legacy injections (window.midnight.mnLace / .lace with enable()/state(),
 * or the Cardano-side window.cardano.laceMidnight) are still recognized so
 * older extension builds keep working.
 */

export type WalletProviderId = string

export interface DetectedWallet {
  id: WalletProviderId
  /** Stable wallet identity (reverse-DNS, e.g. "io.lace.midnight"). Unlike
   * `id` — the per-page-load injection key — this survives reloads. */
  rdns?: string
  name: string
  description: string
  /** Wallet-provided icon URL (hosted resource or base64 data URL), when exposed. */
  icon?: string
  /** True when the wallet implements the v4 InitialAPI (rdns + connect). */
  isV4?: boolean
}

export interface MidnightProviderApi {
  // v4 InitialAPI
  rdns?: string
  name?: string
  icon?: string
  apiVersion?: string
  connect?: (networkId: string) => Promise<Record<string, unknown>>
  // v4 ConnectedAPI
  getUnshieldedAddress?: () => Promise<{ unshieldedAddress: string } | string>
  getShieldedAddresses?: () => Promise<{ shieldedAddress: string } | string>
  getUnshieldedBalances?: () => Promise<Record<string, bigint>>
  makeTransfer?: (outputs: unknown[], options?: unknown) => Promise<{ tx: string }>
  submitTransaction?: (tx: string) => Promise<void>
  // Legacy (pre-v4) surface
  enable?: (...args: unknown[]) => Promise<unknown>
  isEnabled?: () => Promise<boolean>
  state?: () => Promise<unknown>
  address?: () => Promise<string>
  getAddress?: () => Promise<string>
  getUsedAddresses?: () => Promise<string[]>
}

interface InjectedWindow {
  midnight?: Record<string, unknown>
  cardano?: {
    laceMidnight?: { enable: () => Promise<MidnightProviderApi> }
  }
}

/** Brand icon + display metadata keyed by rdns fragment. */
const BRAND_BY_RDNS: Array<{ match: string; name: string; icon: string; description: string }> = [
  { match: 'lace', name: 'Lace', icon: '/wallets/lace.png', description: 'Lace Midnight wallet' },
  { match: '1am', name: '1AM Wallet', icon: '/wallets/1am.png', description: '1AM Midnight wallet' },
]

function brandFor(rdnsOrKey: string): { name: string; icon: string; description: string } | undefined {
  const lower = rdnsOrKey.toLowerCase()
  return BRAND_BY_RDNS.find((b) => lower.includes(b.match))
}

function getWindow(): InjectedWindow | null {
  if (typeof window === 'undefined') return null
  return window as unknown as InjectedWindow
}

/** Scan the window for injected Midnight wallet providers. */
export function detectInjectedWallets(): DetectedWallet[] {
  const win = getWindow()
  if (!win) return []

  const found: DetectedWallet[] = []
  const seen = new Set<string>()

  if (win.midnight) {
    for (const [key, value] of Object.entries(win.midnight)) {
      if (typeof value !== 'object' || value === null) continue
      const api = value as MidnightProviderApi

      const isV4 = typeof api.connect === 'function' && typeof api.rdns === 'string'
      const isLegacy =
        typeof api.enable === 'function' ||
        (typeof api.connect === 'function' && typeof api.rdns !== 'string')
      if (!isV4 && !isLegacy) continue

      const brand = brandFor(api.rdns ?? key)
      const name = api.name || brand?.name || key
      const dedupeKey = api.rdns ?? name
      if (seen.has(dedupeKey)) continue
      seen.add(dedupeKey)

      found.push({
        id: key,
        rdns: api.rdns,
        name,
        description: brand?.description ?? `Midnight wallet${api.apiVersion ? ` (API v${api.apiVersion})` : ''}`,
        icon: brand?.icon ?? (typeof api.icon === 'string' ? api.icon : undefined),
        isV4,
      })
    }
  }

  // Lace Midnight via the Cardano namespace (older builds).
  if (win.cardano?.laceMidnight?.enable && !found.some((w) => w.name === 'Lace')) {
    found.push({
      id: 'cardano:laceMidnight',
      name: 'Lace',
      description: 'Lace (Cardano Midnight edition)',
      icon: '/wallets/lace.png',
    })
  }

  return found
}

/** Extract an account address from whatever shape the wallet API exposes. */
async function resolveAddress(api: MidnightProviderApi): Promise<string | undefined> {
  // v4: unshielded address, returned as { unshieldedAddress } (or plain string in some builds).
  if (typeof api.getUnshieldedAddress === 'function') {
    try {
      const res = (await api.getUnshieldedAddress()) as { unshieldedAddress: string } | string
      const addr = typeof res === 'string' ? res : res?.unshieldedAddress
      if (typeof addr === 'string' && addr) return addr
    } catch {
      // Fall through to the other accessors.
    }
  }
  // v4: shielded address as a fallback identity.
  if (typeof api.getShieldedAddresses === 'function') {
    try {
      const res = (await api.getShieldedAddresses()) as { shieldedAddress: string } | string
      const addr = typeof res === 'string' ? res : res?.shieldedAddress
      if (typeof addr === 'string' && addr) return addr
    } catch {
      // Fall through.
    }
  }
  // Legacy accessors.
  if (typeof api.state === 'function') {
    try {
      const st = (await api.state()) as { address?: string } | null
      if (typeof st?.address === 'string' && st.address) return st.address
    } catch {
      // Fall through.
    }
  }
  if (typeof api.address === 'function') return await api.address()
  if (typeof api.getAddress === 'function') return await api.getAddress()
  if (typeof api.getUsedAddresses === 'function') {
    return (await api.getUsedAddresses())?.[0]
  }
  return undefined
}

/** Network ids tried in order. Per the Lace DApp Connector docs, connect()
 * must target the specific network the dApp operates on — so the app's
 * configured network (preprod for this deployment) is always tried first,
 * with the others as fallbacks for older extension builds. */
function networkIdsToTry(): string[] {
  const configured = midnightPublicConfig.network?.trim()
  const preferred = configured && configured !== 'undeployed' ? configured : 'preprod'
  return [preferred, ...NETWORK_IDS.filter((n) => n !== preferred)]
}

const NETWORK_IDS = ['preview', 'preprod', 'undeployed', 'mainnet']

/**
 * Connect a detected wallet provider and return the raw connected API plus
 * the resolved account address. The extension prompts the user to approve
 * the connection. Payment execution needs the API object itself
 * (makeTransfer/submitTransaction); sign-in only needs the address.
 */
export async function connectWalletApi(
  id: WalletProviderId,
): Promise<{ api: MidnightProviderApi; address: string }> {
  const win = getWindow()
  if (!win) throw new Error('Wallet connection requires a browser environment.')

  let api: MidnightProviderApi | undefined

  if (id.startsWith('cardano:')) {
    const key = id.slice('cardano:'.length)
    const provider = win.cardano?.[key as keyof typeof win.cardano] as
      | { enable: () => Promise<MidnightProviderApi> }
      | undefined
    if (!provider?.enable) {
      throw new Error('The wallet provider is no longer available. Refresh and try again.')
    }
    api = await provider.enable()
  } else {
    const provider = win.midnight?.[id] as MidnightProviderApi | undefined
    if (!provider) {
      throw new Error('The wallet provider is no longer available. Refresh and try again.')
    }

    if (typeof provider.connect === 'function') {
      // v4 connect(networkId) requires an explicit network id. Try the app's
      // configured network first, then the others; the first that resolves wins.
      let lastError: unknown
      for (const networkId of networkIdsToTry()) {
        try {
          api = (await provider.connect(networkId)) as MidnightProviderApi
          break
        } catch (err) {
          lastError = err
        }
      }
      if (!api && lastError) {
        throw lastError instanceof Error
          ? lastError
          : new Error('The wallet rejected the connection request.')
      }
    }

    // Legacy enable() surface.
    if (!api && typeof provider.enable === 'function') {
      if (typeof provider.isEnabled === 'function') {
        try {
          if (!(await provider.isEnabled())) {
            api = (await provider.enable()) as MidnightProviderApi
          } else {
            api = provider
          }
        } catch {
          api = provider
        }
      } else {
        api = (await provider.enable()) as MidnightProviderApi
      }
    }

    if (!api) api = provider
  }

  if (!api) throw new Error('Could not connect to the wallet. Please try again.')

  const address = await resolveAddress(api)
  if (!address) {
    throw new Error('The wallet did not return an account address.')
  }
  return { api, address }
}

/**
 * Connect a detected wallet provider and resolve the connected account
 * address. The extension prompts the user to approve the connection.
 */
export async function enableWallet(id: WalletProviderId): Promise<string> {
  const { address } = await connectWalletApi(id)
  return address
}
