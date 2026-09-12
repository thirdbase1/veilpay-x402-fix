'use client'

import { useState } from 'react'
import {
  Copy,
  Check,
  Calendar,
  Clock,
  Coins,
  Shield,
  Receipt,
  AlertTriangle,
} from 'lucide-react'
import { describeAmountCondition } from '@/lib/payments/intent'
import type { PaymentIntent } from '@/lib/payments/types'

interface PaymentRequirementsProps {
  intent: PaymentIntent
}

export function PaymentRequirements({ intent }: PaymentRequirementsProps) {
  const [copiedRecipient, setCopiedRecipient] = useState(false)

  const { conditions } = intent
  const isExpired =
    intent.status === 'expired' ||
    (conditions.expiresAt && new Date(conditions.expiresAt).getTime() < Date.now())

  const formattedCreated = new Date(intent.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const formattedExpiry = conditions.expiresAt
    ? new Date(conditions.expiresAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'None (Does not expire)'

  const predicateLabel =
    conditions.amount.kind === 'exactly'
      ? 'Exact Amount'
      : conditions.amount.kind === 'at_least'
      ? 'Minimum Threshold'
      : 'Between Range'

  // Format recipient for privacy-conscious display (e.g. mn_addr...8f2a)
  const recipient = conditions.recipient
  const shortRecipient =
    recipient.length > 20
      ? `${recipient.slice(0, 10)}...${recipient.slice(-6)}`
      : recipient

  const handleCopyRecipient = () => {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(recipient)
    setCopiedRecipient(true)
    setTimeout(() => setCopiedRecipient(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm space-y-6">
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Payment Requirements
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verified conditions the customer must satisfy to complete this intent.
          </p>
        </div>
        <Receipt className="size-4 text-muted-foreground" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 text-xs">
        {/* Required Amount & Predicate */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Required Amount
            </span>
            <Coins className="size-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-base font-bold text-foreground">
              {describeAmountCondition(conditions)}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <span>Asset: <strong className="font-mono text-foreground">{conditions.amount.asset}</strong></span>
              <span aria-hidden className="size-1 rounded-full bg-muted-foreground/60" />
              <span>Predicate: <strong className="font-medium text-foreground">{predicateLabel}</strong></span>
            </div>
          </div>
        </div>

        {/* Merchant Recipient */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Configured Recipient
            </span>
            <button
              type="button"
              onClick={handleCopyRecipient}
              aria-label="Copy recipient address"
              className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {copiedRecipient ? (
                <>
                  <Check className="size-3 text-emerald-400" />
                  <span className="text-emerald-400 font-mono">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span className="font-mono">Copy Full Address</span>
                </>
              )}
            </button>
          </div>
          <div>
            <p
              className="font-mono text-xs font-semibold text-foreground break-all select-all"
              title={recipient}
            >
              {shortRecipient}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Target address verified on Midnight
            </p>
          </div>
        </div>

        {/* Creation Info */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Created Timestamp
            </span>
            <Clock className="size-3.5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-mono text-xs text-foreground">
              {formattedCreated}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Network: <span className="font-mono text-foreground">{intent.network || 'testnet'}</span>
            </p>
          </div>
        </div>

        {/* Expiration Deadline */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Expiration
            </span>
            <Calendar className="size-3.5 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-mono text-xs text-foreground">
                {formattedExpiry}
              </p>
              {isExpired && (
                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/30">
                  <AlertTriangle className="size-2.5" />
                  Expired
                </span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {isExpired
                ? 'Deadline has elapsed; payments will no longer be accepted.'
                : 'Settlements submitted after this deadline are rejected.'}
            </p>
          </div>
        </div>
      </div>

      {/* Reference Section */}
      <div className="rounded-xl border border-border/50 bg-background/30 p-3.5 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Merchant Reference:</span>
        <span className="font-mono font-medium text-foreground">
          {conditions.reference?.trim() || 'No reference'}
        </span>
      </div>

      {/* Privacy note */}
      <div className="rounded-xl border border-border/40 bg-background/20 p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
        <Shield className="size-4 text-primary shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          VeilPay is designed to minimize unnecessary disclosure. Payer wallet history, total balances, and off-intent activity remain shielded by Midnight&apos;s zero-knowledge architecture.
        </p>
      </div>
    </div>
  )
}
