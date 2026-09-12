'use client'

import { useState, useEffect } from 'react'
import type { PaymentIntent } from '@/lib/payments/types'
import { describeAmountCondition } from '@/lib/payments/intent'
import { PaymentIntentStatusBadge } from '@/components/dashboard/payment-intent-status'
import { Clock, Copy, Check, Store, Tag } from 'lucide-react'

interface CheckoutCardProps {
  intent: PaymentIntent
}

export function CheckoutCard({ intent }: CheckoutCardProps) {
  const [copiedId, setCopiedId] = useState(false)
  const [copiedRecipient, setCopiedRecipient] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string | null>(null)

  const { conditions } = intent

  // Live expiration timer (informational only; server is authoritative)
  useEffect(() => {
    if (!conditions.expiresAt) return

    const updateTimer = () => {
      const diff = new Date(conditions.expiresAt!).getTime() - Date.now()
      if (diff <= 0) {
        setTimeLeft('Expired')
        return
      }

      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)

      if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m remaining`)
      } else if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s remaining`)
      } else {
        setTimeLeft(`${seconds}s remaining`)
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [conditions.expiresAt])

  const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback if clipboard API restricted
    }
  }

  return (
    <article
      aria-label="Payment Request Details"
      className="rounded-2xl border border-border/80 bg-card/60 p-6 sm:p-8 backdrop-blur-sm space-y-6 shadow-2xl"
    >
      {/* Top Bar: Intent ID & Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] text-muted-foreground uppercase tracking-wider">
            Intent ID:
          </span>
          <code className="rounded bg-muted/60 px-2 py-0.5 font-mono text-xs text-foreground font-medium truncate max-w-[170px] sm:max-w-xs">
            {intent.id}
          </code>
          <button
            type="button"
            onClick={() => copyToClipboard(intent.id, setCopiedId)}
            aria-label={copiedId ? 'Copied ID' : 'Copy payment intent ID'}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
          >
            {copiedId ? (
              <Check className="size-3 text-accent" aria-hidden="true" />
            ) : (
              <Copy className="size-3" aria-hidden="true" />
            )}
          </button>
        </div>

        <PaymentIntentStatusBadge status={intent.status} />
      </div>

      {/* Main Focus: Payment Condition Amount */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-5 sm:p-6 text-center space-y-2">
        <p className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
          Payment Condition to Satisfy
        </p>

        {/* Amount is the primary visual centerpiece */}
        <div className="py-1">
          <p className="font-mono text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            {describeAmountCondition(conditions)}
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Denominated in{' '}
            <span className="font-semibold text-foreground">{conditions.amount.asset}</span>
          </p>
        </div>

        {conditions.reference && (
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 font-mono text-xs text-muted-foreground">
            <Tag className="size-3 text-primary" aria-hidden="true" />
            <span>Ref: {conditions.reference}</span>
          </div>
        )}
      </div>

      {/* Merchant Destination & Timeline Details */}
      <div className="space-y-3 text-xs">
        {/* Merchant Destination Address */}
        <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
          <div className="flex items-center gap-1.5 text-muted-foreground shrink-0 pt-0.5">
            <Store className="size-3.5" aria-hidden="true" />
            <span>Merchant Account</span>
          </div>
          <div className="flex items-center gap-1.5 min-w-0 max-w-[240px] sm:max-w-sm justify-end">
            <span
              className="font-mono text-foreground truncate select-all"
              title={conditions.recipient}
            >
              {conditions.recipient}
            </span>
            <button
              type="button"
              onClick={() => copyToClipboard(conditions.recipient, setCopiedRecipient)}
              aria-label={copiedRecipient ? 'Copied merchant address' : 'Copy merchant address'}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0"
            >
              {copiedRecipient ? (
                <Check className="size-3 text-accent" aria-hidden="true" />
              ) : (
                <Copy className="size-3" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Expiration Indicator */}
        {conditions.expiresAt && (
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-3.5" aria-hidden="true" />
              <span>Valid Until</span>
            </div>
            <div className="text-right">
              <span className="font-mono text-foreground">
                {new Date(conditions.expiresAt).toLocaleString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
              {timeLeft && (
                <span className="block font-mono text-[11px] text-muted-foreground">
                  ({timeLeft})
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  )
}
