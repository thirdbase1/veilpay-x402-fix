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

interface WalletContextValue {
  status: WalletConnectionStatus
  account: WalletAccount | null
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
  const [error, setError] = useState<string | null>(null)
  const [isExtensionDetected, setIsExtensionDetected] = useState(false)

  // Check if a real Midnight or Lace extension is injected in the browser window
  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkExtension = () => {
      // Standard window injection for Midnight / Midnight Lace
      const win = window as unknown as {
        midnight?: { isAvailable?: boolean }
        cardano?: { laceMidnight?: unknown }
      }
      const detected = Boolean(win.midnight || win.cardano?.laceMidnight)
      setIsExtensionDetected(detected)
    }

    checkExtension()
    const timer = setTimeout(checkExtension, 1000)
    return () => clearTimeout(timer)
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

      const win = window as unknown as {
        midnight?: {
          enable?: () => Promise<{ getAddress: () => Promise<string> }>
        }
        cardano?: {
          laceMidnight?: {
            enable: () => Promise<{ getUsedAddresses?: () => Promise<string[]> }>
          }
        }
      }

      // If a real extension is available, attempt real handshake
      if (win.midnight?.enable) {
        const api = await win.midnight.enable()
        const address = await api.getAddress()
        setAccount({
          address,
          network: midnightPublicConfig.network || 'testnet',
        })
        setStatus('connected')
        return
      }

      if (win.cardano?.laceMidnight?.enable) {
        const api = await win.cardano.laceMidnight.enable()
        const addrs = (await api.getUsedAddresses?.()) || []
        const address = addrs[0] || 'mn_connected_account'
        setAccount({
          address,
          network: midnightPublicConfig.network || 'testnet',
        })
        setStatus('connected')
        return
      }

      // Truthful: No fake connected state!
      setStatus('disconnected')
      setError(
        'No Midnight-compatible wallet extension (such as Lace Midnight edition) was detected in this browser.',
      )
    } catch (err: unknown) {
      setStatus('disconnected')
      const msg = err instanceof Error ? err.message : 'Wallet rejected connection request.'
      setError(msg)
    }
  }, [])

  const disconnect = useCallback(() => {
    setAccount(null)
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
