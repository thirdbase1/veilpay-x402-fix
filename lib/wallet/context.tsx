'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { WalletAccount, WalletConnectionStatus } from './types'
import { midnightPublicConfig } from '@/lib/config'
import { detectInjectedWallets, connectWalletApi } from './detect'

interface WalletContextValue {
  status: WalletConnectionStatus
  account: WalletAccount | null
  /** Id of the injected provider this account was connected through. */
  walletId: string | null
  error: string | null
  isExtensionDetected: boolean
  connect: () => Promise<void>
  disconnect: () => void
  clearError: () => void
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined)

/** Remembers which extension the merchant connected through, so the session
 * can be silently restored after a page reload (the auth cookie alone makes
 * the UI look connected while the wallet context is empty). */
const WALLET_ID_STORAGE_KEY = 'veilpay.connectedWalletId'

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletConnectionStatus>('disconnected')
  const [account, setAccount] = useState<WalletAccount | null>(null)
  const [walletId, setWalletId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isExtensionDetected, setIsExtensionDetected] = useState(false)

  // Extensions inject asynchronously after page load — poll with backoff
  // instead of checking once, so a slow-injecting Lace/1AM is still found.
  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkExtension = () => setIsExtensionDetected(detectInjectedWallets().length > 0)

    checkExtension()
    const delays = [500, 1500, 3000, 5000]
    const timers = delays.map((d) => setTimeout(checkExtension, d))
    return () => timers.forEach(clearTimeout)
  }, [])

  const connect = useCallback(async () => {
    setError(null)
    setStatus('connecting')

    try {
      if (typeof window === 'undefined') {
        setStatus('unsupported')
        setError('Wallet connection requires a browser environment.')
        return
      }

      const wallets = detectInjectedWallets()
      if (wallets.length === 0) {
        setStatus('disconnected')
        setError(
          'No Midnight-compatible wallet extension (such as Lace Midnight edition) was detected in this browser.',
        )
        return
      }

      // Connect to the first detected wallet; if it fails (e.g. user
      // rejected in that extension), try the next one before giving up.
      let lastError: unknown
      for (const wallet of wallets) {
        try {
          const { address } = await connectWalletApi(wallet.id)
          setAccount({
            address,
            network: midnightPublicConfig.network || 'testnet',
          })
          setWalletId(wallet.id)
          window.localStorage.setItem(WALLET_ID_STORAGE_KEY, wallet.id)
          setStatus('connected')
          return
        } catch (err) {
          lastError = err
        }
      }

      setStatus('disconnected')
      setError(
        lastError instanceof Error
          ? lastError.message
          : 'Wallet rejected connection request.',
      )
    } catch (err: unknown) {
      setStatus('disconnected')
      const msg = err instanceof Error ? err.message : 'Wallet rejected connection request.'
      setError(msg)
    }
  }, [])

  // Silently restore a previous wallet session after a page reload. The
  // connector's connect() is prompt-free for already-authorized origins, so
  // this only succeeds when the merchant approved this dapp before.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (status !== 'disconnected') return

    const stored = window.localStorage.getItem(WALLET_ID_STORAGE_KEY)
    if (!stored) return
    if (!detectInjectedWallets().some((w) => w.id === stored)) return

    let cancelled = false
    ;(async () => {
      try {
        const { address } = await connectWalletApi(stored)
        if (cancelled) return
        setAccount({
          address,
          network: midnightPublicConfig.network || 'testnet',
        })
        setWalletId(stored)
        setStatus('connected')
      } catch {
        // Restore is best-effort — the merchant can connect manually.
        window.localStorage.removeItem(WALLET_ID_STORAGE_KEY)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [status, isExtensionDetected])

  const disconnect = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(WALLET_ID_STORAGE_KEY)
    }
    setAccount(null)
    setWalletId(null)
    setStatus('disconnected')
    setError(null)
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <WalletContext.Provider
      value={{
        status,
        account,
        walletId,
        error,
        isExtensionDetected,
        connect,
        disconnect,
        clearError,
      }}
    >
      {children}
    </WalletContext.Provider>
  )
}

const defaultWalletValue: WalletContextValue = {
  status: 'disconnected',
  account: null,
  walletId: null,
  error: null,
  isExtensionDetected: false,
  connect: async () => {},
  disconnect: () => {},
  clearError: () => {},
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext)
  return ctx || defaultWalletValue
}
