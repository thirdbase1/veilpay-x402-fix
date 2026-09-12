'use client'

/**
 * Detection and connection for injected Midnight wallet extensions.
 *
 * Midnight-compatible wallets inject a provider under `window.midnight`:
 *   - Lace:            window.midnight.lace
 *   - 1AM Wallet:      window.midnight['1am']
 * Legacy injections (a default `window.midnight.enable` or the Cardano-side
 * `window.cardano.laceMidnight`) are also recognized so older extension
 * builds keep working.
 */

export type WalletProviderId = 'lace' | '1am' | 'midnight-default' | 'lace-midnight'

export interface DetectedWallet {
  id: WalletProviderId
  name: string
  description: string
}

interface MidnightProviderApi {
  enable?: () => Promise<MidnightProviderApi>
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

const KNOWN_WALLETS: Record<string, { name: string; description: string }> = {
  lace: { name: 'Lace', description: 'Lace Midnight wallet' },
  '1am': { name: '1AM Wallet', description: '1AM Midnight wallet' },
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

  if (win.midnight) {
    for (const key of Object.keys(win.midnight)) {
      const provider = win.midnight[key]
      if (key === 'isAvailable' || typeof provider !== 'object' || provider === null) continue
      if (typeof (provider as MidnightProviderApi).enable !== 'function') continue
      const known = KNOWN_WALLETS[key]
      found.push({
        id: key === 'lace' ? 'lace' : key === '1am' ? '1am' : (`ext-${key}` as WalletProviderId),
        name: known?.name ?? key,
        description: known?.description ?? `Midnight wallet "${key}"`,
      })
    }
    // A default provider directly on window.midnight (older builds).
    if (typeof win.midnight.enable === 'function' && !found.some((w) => w.id === 'lace' || w.id === '1am')) {
      found.push({
        id: 'midnight-default',
        name: 'Midnight Wallet',
        description: 'Default injected Midnight provider',
      })
    }
  }

  if (win.cardano?.laceMidnight?.enable && !found.some((w) => w.id === 'lace')) {
    found.push({
      id: 'lace-midnight',
      name: 'Lace',
      description: 'Lace (Cardano Midnight edition)',
    })
  }

  return found
}

/**
 * Enable a detected wallet provider and resolve the connected account address.
 * The extension prompts the user to approve the connection.
 */
export async function enableWallet(id: WalletProviderId): Promise<string> {
  const win = getWindow()
  if (!win) throw new Error('Wallet connection requires a browser environment.')

  let api: MidnightProviderApi | undefined

  if (id === 'midnight-default') {
    api = await win.midnight?.enable?.()
  } else if (id === 'lace-midnight') {
    api = await win.cardano?.laceMidnight?.enable()
  } else if (win.midnight && id in win.midnight) {
    const provider = win.midnight[id] as MidnightProviderApi | undefined
    if (typeof provider?.enable !== 'function') {
      throw new Error('The wallet provider is no longer available. Refresh and try again.')
    }
    api = await provider.enable()
  }

  if (!api) throw new Error('Could not connect to the wallet. Please try again.')

  const address =
    (typeof api.address === 'function' ? await api.address() : undefined) ??
    (typeof api.getAddress === 'function' ? await api.getAddress() : undefined) ??
    (typeof api.getUsedAddresses === 'function' ? (await api.getUsedAddresses())?.[0] : undefined)

  if (!address) {
    throw new Error('The wallet did not return an account address.')
  }
  return address
}
