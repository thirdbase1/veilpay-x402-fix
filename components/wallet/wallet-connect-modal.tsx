'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { WalletConnectForm } from './wallet-connect-form'

interface WalletConnectModalProps {
  open: boolean
  onClose: () => void
  redirect?: string
}

/** Inline 1AM wallet connect dialog, openable from any page via the nav icon. */
export function WalletConnectModal({ open, onClose, redirect }: WalletConnectModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Connect 1AM Wallet"
    >
      <button
        type="button"
        aria-label="Close wallet dialog"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-background/80 backdrop-blur-sm"
        tabIndex={-1}
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card/95 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" />
        </button>
        <WalletConnectForm redirect={redirect} onSuccess={onClose} />
      </div>
    </div>
  )
}
