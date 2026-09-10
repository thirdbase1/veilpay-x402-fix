'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ChevronRight,
  Copy,
  Check,
  RefreshCw,
  Ban,
  Loader2,
  ArrowLeft,
} from 'lucide-react'
import { PaymentIntentStatusBadge } from '@/components/dashboard/payment-intent-status'
import type { PaymentIntent } from '@/lib/payments/types'

interface PaymentIntentHeaderProps {
  intent: PaymentIntent
  onRefresh: () => Promise<void>
  isRefreshing: boolean
  onCancel: () => Promise<void>
  isCancelling: boolean
}

export function PaymentIntentHeader({
  intent,
  onRefresh,
  isRefreshing,
  onCancel,
  isCancelling,
}: PaymentIntentHeaderProps) {
  const [copiedId, setCopiedId] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const handleCopyId = () => {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(intent.id)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const canCancel = ['draft', 'awaiting_payment'].includes(intent.status)

  return (
    <div className="space-y-4">
      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto whitespace-nowrap py-0.5 no-scrollbar"
      >
        <Link
          href="/app"
          className="hover:text-foreground transition-colors shrink-0"
        >
          Dashboard
        </Link>
        <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />
        <Link
          href="/app/intents"
          className="hover:text-foreground transition-colors shrink-0"
        >
          Payment Intents
        </Link>
        <ChevronRight className="size-3 text-muted-foreground/50 shrink-0" />
        <span
          className="font-mono text-foreground truncate max-w-[140px] sm:max-w-xs md:max-w-none shrink"
          title={intent.id}
        >
          {intent.id}
        </span>
      </nav>

      {/* Main Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/70 pb-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Link
              href="/app/intents"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground sm:hidden mb-1"
            >
              <ArrowLeft className="size-3" />
              All Intents
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Payment Intent
            </h1>
            <PaymentIntentStatusBadge status={intent.status} />
          </div>

          {/* Real Intent ID with un-shortened copy */}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <span className="text-xs text-muted-foreground shrink-0">ID:</span>
            <code className="rounded bg-muted/60 px-2 py-0.5 font-mono text-xs text-foreground font-medium select-all break-all sm:break-normal max-w-full">
              {intent.id}
            </code>
            <button
              type="button"
              onClick={handleCopyId}
              aria-label={copiedId ? 'Copied ID' : 'Copy payment intent ID'}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              {copiedId ? (
                <>
                  <Check className="size-3 text-emerald-400" />
                  <span className="text-emerald-400 font-mono text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="size-3" />
                  <span className="font-mono text-[11px]">Copy ID</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Action Controls: Refresh & Cancel */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            aria-label="Refresh intent status"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background/60 px-2.5 text-xs font-medium text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`size-3.5 ${isRefreshing ? 'animate-spin text-primary' : 'text-muted-foreground'}`}
            />
            <span>Refresh</span>
          </button>

          {canCancel && !confirmCancel && (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-950/10 px-2.5 text-xs font-medium text-rose-400 hover:bg-rose-950/30 transition-colors"
            >
              <Ban className="size-3.5" />
              <span>Cancel Intent</span>
            </button>
          )}

          {canCancel && confirmCancel && (
            <div className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/30 p-1">
              <span className="px-1 text-[11px] text-rose-300 font-medium">Confirm?</span>
              <button
                type="button"
                onClick={async () => {
                  await onCancel()
                  setConfirmCancel(false)
                }}
                disabled={isCancelling}
                className="inline-flex h-6 items-center gap-1 rounded bg-rose-600 px-2 text-[11px] font-semibold text-white hover:bg-rose-500 transition-colors disabled:opacity-50"
              >
                {isCancelling ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  'Yes, cancel'
                )}
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancel(false)}
                disabled={isCancelling}
                className="inline-flex h-6 items-center rounded bg-muted/60 px-2 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
              >
                Keep
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
