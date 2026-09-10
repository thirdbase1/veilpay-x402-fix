'use client'

import { useState, useEffect } from 'react'
import { Wallet, Check, Copy, ExternalLink, AlertCircle, LogOut } from 'lucide-react'
import { midnightPublicConfig } from '@/lib/config'

interface CheckoutWalletProps {
  connectedAddress: string | null
  onConnected: (address: string) => void
  onDisconnected: () => void
}

export function CheckoutWallet({
  connectedAddress,
  onConnected,
  onDisconnected,
}: CheckoutWalletProps) {
  const [isExtensionDetected, setIsExtensionDetected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Real detection of Midnight wallet extension in the browser
  useEffect(() => {
    if (typeof window === 'undefined') return

    const checkWallet = () => {
      const win = window as unknown as {
        midnight?: { isAvailable?: boolean; enable?: () => unknown }
        cardano?: { laceMidnight?: { enable?: () => unknown } }
      }
      const detected = Boolean(win.midnight || win.cardano?.laceMidnight)
      setIsExtensionDetected(detected)
    }

    checkWallet()
    // Periodic check in case extension injects asynchronously
    const timer = setTimeout(checkWallet, 1000)
    return () => clearTimeout(timer)
  }, [])

  const handleConnect = async () => {
    setIsConnecting(true)
    setWalletError(null)

    try {
      const win = window as unknown as {
        midnight?: {
          enable?: () => Promise<{
            getAddress?: () => Promise<string>
            getAccounts?: () => Promise<string[]>
          }>
        }
        cardano?: {
          laceMidnight?: {
            enable?: () => Promise<{
              getUsedAddresses?: () => Promise<string[]>
              getChangeAddress?: () => Promise<string>
            }>
          }
        }
      }

      if (win.midnight?.enable) {
        const api = await win.midnight.enable()
        let address = ''
        if (typeof api.getAddress === 'function') {
          address = await api.getAddress()
        } else if (typeof api.getAccounts === 'function') {
          const accounts = await api.getAccounts()
          address = accounts[0] || ''
        }
        if (address) {
          onConnected(address)
        } else {
          throw new Error('No active account returned from Midnight wallet.')
        }
      } else if (win.cardano?.laceMidnight?.enable) {
        const api = await win.cardano.laceMidnight.enable()
        let address = ''
        if (typeof api.getUsedAddresses === 'function') {
          const addrs = await api.getUsedAddresses()
          address = addrs[0] || ''
        }
        if (!address && typeof api.getChangeAddress === 'function') {
          address = await api.getChangeAddress()
        }
        if (address) {
          onConnected(address)
        } else {
          throw new Error('No active account returned from Lace Midnight.')
        }
      } else {
        // Honest unavailable state
        setWalletError(
          'No Midnight-compatible wallet extension was detected. Please install or enable the Lace Midnight edition browser extension to connect.',
        )
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Wallet connection was cancelled or rejected.'
      setWalletError(message)
    } finally {
      setIsConnecting(false)
    }
  }

  const handleCopy = async () => {
    if (!connectedAddress) return
    try {
      await navigator.clipboard.writeText(connectedAddress)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore clipboard error
    }
  }

  if (connectedAddress) {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/10 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs font-semibold text-emerald-400">
              Midnight Wallet Connected
            </span>
          </div>

          <button
            type="button"
            onClick={onDisconnected}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-rose-400 transition-colors"
          >
            <LogOut className="size-3" aria-hidden="true" />
            <span>Disconnect</span>
          </button>
        </div>

        <div className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-1">
          <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            Payer Account (Local Verification Only)
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-xs text-foreground truncate select-all">
              {connectedAddress}
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
              aria-label="Copy payer account"
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-400" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Network:{' '}
          <span className="font-mono text-foreground font-medium">
            Midnight ({midnightPublicConfig.network || 'testnet'})
          </span>
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/40 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="size-4 text-primary" aria-hidden="true" />
          <h3 className="text-xs font-semibold text-foreground">Midnight Wallet</h3>
        </div>

        <span
          className={`font-mono text-[10px] px-2 py-0.5 rounded-full border ${
            isExtensionDetected
              ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400'
              : 'border-zinc-700 bg-zinc-900/60 text-muted-foreground'
          }`}
        >
          {isExtensionDetected ? 'Extension Detected' : 'Extension Not Detected'}
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Connect your Midnight-compatible wallet (such as Lace Midnight edition) to sign the payment
        condition. VeilPay will never request access to your private keys or seed phrase.
      </p>

      {/* Connect Button */}
      <button
        type="button"
        onClick={handleConnect}
        disabled={isConnecting}
        className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Wallet className="size-4" aria-hidden="true" />
        <span>{isConnecting ? 'Awaiting Wallet Connection...' : 'Connect Midnight Wallet'}</span>
      </button>

      {/* Error or extension not detected guidance */}
      {walletError && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 flex items-start gap-2 text-xs text-amber-300">
          <AlertCircle className="size-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-medium">Wallet Notice</p>
            <p className="text-[11px] text-amber-300/90 leading-relaxed">{walletError}</p>
          </div>
        </div>
      )}

      {!isExtensionDetected && !walletError && (
        <div className="rounded-xl border border-border/60 bg-muted/20 p-3 flex items-start justify-between gap-3 text-xs text-muted-foreground">
          <div className="space-y-0.5">
            <p className="font-medium text-foreground text-[11px]">Need a Midnight Wallet?</p>
            <p className="text-[11px] leading-relaxed">
              Lace Midnight preview wallet enables zero-knowledge proving in your browser.
            </p>
          </div>
          <a
            href="https://midnight.network"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline shrink-0 pt-0.5"
          >
            <span>Docs</span>
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  )
}
