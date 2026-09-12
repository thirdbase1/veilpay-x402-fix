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

  const disconnect = useCallback(() => {
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
