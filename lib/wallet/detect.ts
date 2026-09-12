'use client'

/**
 * Detection and connection for injected Midnight wallet extensions.
 *
 * Injection points follow the official wallet documentation:
 *   - Lace Midnight:   window.midnight.mnLace
 *       isEnabled() -> boolean, enable() -> WalletAPI, state() -> { address, ... }
 *   - 1AM Wallet:      window.midnight['1am']
 *       connect(networkId) -> ConnectedAPI
 *
 * Legacy injections (window.midnight.lace, a default window.midnight.enable,
 * or the Cardano-side window.cardano.laceMidnight) are also recognized so
 * older extension builds keep working.
 */

export type WalletProviderId = 'lace' | '1am' | 'midnight-default' | 'lace-midnight'

export interface DetectedWallet {
  id: WalletProviderId
  name: string
  description: string
}

interface MidnightProviderApi {
  enable?: (...args: unknown[]) => Promise<unknown>
  connect?: (...args: unknown[]) => Promise<unknown>
  isEnabled?: () => Promise<boolean>
  state?: () => Promise<unknown>
  address?: () => Promise<string>
  getAddress?: () => Promise<string>
  getUsedAddresses?: () => Promise<string[]>
}

interface InjectedWindow {
  midnight?: Record<string, unknown> & {
    enable?: () => Promise<MidnightProviderApi>
    isAvailable?: boolean
  }
  cardano?: {
    laceMidnight?: { enable: () => Promise<MidnightProviderApi> }
  }
}

const KNOWN_WALLETS: Record<string, { id: WalletProviderId; name: string; description: string }> = {
  mnLace: { id: 'lace', name: 'Lace', description: 'Lace Midnight wallet' },
  lace: { id: 'lace', name: 'Lace', description: 'Lace Midnight wallet' },
  '1am': { id: '1am', name: '1AM Wallet', description: '1AM Midnight wallet' },
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
  const seen = new Set<WalletProviderId>()

  if (win.midnight) {
    for (const key of Object.keys(win.midnight)) {
      const provider = win.midnight[key]
      if (key === 'isAvailable' || typeof provider !== 'object' || provider === null) continue
      const api = provider as MidnightProviderApi
      if (typeof api.enable !== 'function' && typeof api.connect !== 'function') continue

      const known = KNOWN_WALLETS[key]
      const id = known?.id ?? (`ext-${key}` as WalletProviderId)
      if (seen.has(id)) continue
      seen.add(id)
      found.push({
        id,
        name: known?.name ?? key,
        description: known?.description ?? `Midnight wallet "${key}"`,
      })
    }

    // A default provider directly on window.midnight (older builds).
    if (
      typeof win.midnight.enable === 'function' &&
      !found.some((w) => w.id === 'lace' || w.id === '1am')
    ) {
      seen.add('midnight-default')
      found.push({
        id: 'midnight-default',
        name: 'Midnight Wallet',
        description: 'Default injected Midnight provider',
      })
    }
  }

  if (win.cardano?.laceMidnight?.enable && !seen.has('lace')) {
    found.push({
      id: 'lace-midnight',
      name: 'Lace',
      description: 'Lace (Cardano Midnight edition)',
    })
  }

  return found
}

/** Extract an account address from whatever shape the wallet API exposes. */
async function resolveAddress(api: MidnightProviderApi): Promise<string | undefined> {
  if (typeof api.state === 'function') {
    try {
      const st = (await api.state()) as { address?: string } | null
      if (typeof st?.address === 'string' && st.address) return st.address
    } catch {
      // Fall through to the other accessors.
    }
  }
  if (typeof api.address === 'function') return await api.address()
  if (typeof api.getAddress === 'function') return await api.getAddress()
  if (typeof api.getUsedAddresses === 'function') {
    return (await api.getUsedAddresses())?.[0]
  }
  return undefined
}

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

  if (id === 'midnight-default') {
    api = await win.midnight?.enable?.()
  } else if (id === 'lace-midnight') {
    api = await win.cardano?.laceMidnight?.enable()
  } else if (win.midnight) {
    // Resolve the provider by wallet id (mnLace for Lace, '1am' for 1AM).
    const key = Object.keys(win.midnight).find((k) => KNOWN_WALLETS[k]?.id === id)
    const provider = key ? (win.midnight[key] as MidnightProviderApi | undefined) : undefined
    if (!provider) {
      throw new Error('The wallet provider is no longer available. Refresh and try again.')
    }

    if (typeof provider.isEnabled === 'function') {
      try {
        if (!(await provider.isEnabled()) && typeof provider.enable === 'function') {
          api = (await provider.enable()) as MidnightProviderApi
        } else {
          api = provider
        }
      } catch {
        api = provider
      }
    }

    if (!api && typeof provider.enable === 'function') {
      api = (await provider.enable()) as MidnightProviderApi
    }

    // 1AM exposes connect(networkId) instead of enable().
    if (!api && typeof provider.connect === 'function') {
      try {
        api = (await provider.connect()) as MidnightProviderApi
      } catch {
        // Some builds require an explicit network id; 'preview' is the
        // documented default for development.
        api = (await provider.connect('preview')) as MidnightProviderApi
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
