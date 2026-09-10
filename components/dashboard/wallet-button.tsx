'use client'

import { useState } from 'react'
import { useWallet } from '@/lib/wallet/context'
import { Wallet, LogOut, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react'
import { midnightPublicConfig } from '@/lib/config'

export function WalletButton() {
  const { status, account, error, connect, disconnect, clearError } = useWallet()
  const [showMenu, setShowMenu] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!account?.address) return
    navigator.clipboard.writeText(account.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (status === 'connecting') {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-card/60 px-3 font-mono text-xs text-muted-foreground opacity-80"
        aria-busy="true"
        aria-label="Connecting wallet"
      >
        <Loader2 className="size-3.5 animate-spin text-primary" />
        Connecting...
      </button>
    )
  }

  if (status === 'connected' && account) {
    const truncated = `${account.address.slice(0, 6)}...${account.address.slice(-4)}`
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowMenu((prev) => !prev)}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-border/80 bg-card/80 px-3 font-mono text-xs text-foreground transition hover:border-border hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={showMenu}
          aria-haspopup="true"
        >
          <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
          <span className="font-medium text-foreground">{truncated}</span>
        </button>

        {showMenu && (
          <div
            className="absolute right-0 top-full z-50 mt-1.5 w-64 rounded-xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-md"
            role="menu"
          >
            <div className="mb-2.5 pb-2 border-b border-border/60">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">Connected Account</p>
              <p className="mt-0.5 break-all font-mono text-xs text-foreground">{account.address}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Network: {account.network}</p>
            </div>

            <div className="space-y-1">
              <button
                type="button"
                onClick={handleCopy}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground transition hover:bg-muted/40"
              >
                {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                {copied ? 'Address copied' : 'Copy full address'}
              </button>

              <button
                type="button"
                onClick={() => {
                  disconnect()
                  setShowMenu(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-400 transition hover:bg-rose-950/20"
              >
                <LogOut className="size-3.5" />
                Disconnect wallet
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => connect()}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-secondary/60 px-3.5 text-xs font-medium text-foreground transition hover:border-border/80 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Wallet className="size-3.5 text-muted-foreground" />
        Connect wallet
      </button>

      {error && (
        <div
          role="alert"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-amber-500/30 bg-card/95 p-3 text-xs shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="font-medium text-foreground">Wallet Unavailable</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{error}</p>
              <p className="mt-1.5 text-[10px] text-muted-foreground/80">
                Network: <span className="font-mono text-foreground">{midnightPublicConfig.network}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearError}
            className="mt-2.5 w-full rounded-md border border-border/80 py-1 text-center text-[11px] font-medium text-muted-foreground hover:bg-muted/30"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
