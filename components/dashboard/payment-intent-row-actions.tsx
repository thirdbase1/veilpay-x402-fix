'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { PaymentIntent } from '@/lib/payments/types'
import { getPaymentLink } from '@/lib/payments/payment-intents'
import { Copy, Check, ExternalLink, ArrowUpRight, Ban } from 'lucide-react'

interface PaymentIntentRowActionsProps {
  intent: PaymentIntent
  onCancelClick?: (intent: PaymentIntent) => void
  compact?: boolean
}

export function PaymentIntentRowActions({
  intent,
  onCancelClick,
  compact = false,
}: PaymentIntentRowActionsProps) {
  const [copied, setCopied] = useState(false)
  const canCancel = intent.status === 'draft' || intent.status === 'awaiting_payment'
  // Chain-backed intents carry their one-time payment secret in the link
  // fragment so the customer can satisfy the intent without a wallet.
  const checkoutUrl = getPaymentLink(intent.id, undefined, intent.paymentSecret)

  const handleCopyLink = async () => {
    try {
      const fullUrl =
        typeof window !== 'undefined'
          ? `${window.location.origin}${checkoutUrl}`
          : checkoutUrl
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.warn('[VeilPay] Clipboard copy failed:', err)
    }
  }

  return (
    <div className="flex items-center justify-end gap-1.5 font-sans">
      {/* Copy Customer Checkout Link */}
      <button
        type="button"
        onClick={handleCopyLink}
        title={copied ? 'Payment link copied' : 'Copy customer checkout link'}
        aria-label={copied ? 'Link copied' : 'Copy payment link'}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border/70 bg-background/80 px-2 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {copied ? (
          <>
            <Check className="size-3 text-emerald-400" />
            <span className="text-emerald-400 font-mono text-[10px]">Copied</span>
          </>
        ) : (
          <>
            <Copy className="size-3" />
            {!compact && <span className="hidden sm:inline">Copy Link</span>}
          </>
        )}
      </button>

      {/* Open Customer Checkout */}
      <a
        href={checkoutUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Open customer checkout in new tab"
        aria-label="Open customer checkout"
        className="inline-flex size-7 items-center justify-center rounded-md border border-border/70 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <ExternalLink className="size-3" />
      </a>

      {/* Manage Intent Details */}
      <Link
        href={`/app/intents/${intent.id}`}
        title="Open intent management console"
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border/80 bg-secondary/80 px-2 text-[11px] font-medium text-foreground hover:bg-secondary hover:border-border transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span>Manage</span>
        <ArrowUpRight className="size-3" />
      </Link>

      {/* Cancel Action if Eligible */}
      {canCancel && onCancelClick && (
        <button
          type="button"
          onClick={() => onCancelClick(intent)}
          title="Cancel this payment intent"
          aria-label="Cancel intent"
          className="inline-flex size-7 items-center justify-center rounded-md border border-rose-500/30 bg-rose-950/20 text-rose-400 hover:bg-rose-950/40 hover:text-rose-300 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-500"
        >
          <Ban className="size-3" />
        </button>
      )}
    </div>
  )
}
