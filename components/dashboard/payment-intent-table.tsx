'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { PaymentIntent } from '@/lib/payments/types'
import { PaymentIntentStatusBadge } from './payment-intent-status'
import { PaymentIntentRowActions } from './payment-intent-row-actions'
import { PaymentIntentCancelDialog } from './payment-intent-cancel-dialog'
import { EmptyState } from './empty-state'
import { describeAmountCondition } from '@/lib/payments/intent'
import { Copy, Check, FilterX } from 'lucide-react'

interface PaymentIntentTableProps {
  intents: PaymentIntent[]
  isLoading?: boolean
  isFiltered?: boolean
  onResetFilters?: () => void
  onIntentUpdated?: (updated: PaymentIntent) => void
}

export function PaymentIntentTable({
  intents,
  isLoading = false,
  isFiltered = false,
  onResetFilters,
  onIntentUpdated,
}: PaymentIntentTableProps) {
  const [intentToCancel, setIntentToCancel] = useState<PaymentIntent | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyId = async (id: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(id)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1800)
    } catch (err) {
      console.warn('[VeilPay] ID copy failed:', err)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3 p-4 sm:p-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 w-full animate-pulse rounded-xl bg-muted/30 border border-border/40" />
        ))}
      </div>
    )
  }

  if (intents.length === 0) {
    if (isFiltered) {
      return (
        <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center space-y-3">
          <div className="flex size-10 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground">
            <FilterX className="size-5" />
          </div>
          <p className="text-sm font-semibold text-foreground">No invoices match your criteria</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Try adjusting your search query, status filters, or sorting preferences.
          </p>
          {onResetFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="mt-2 text-xs font-mono text-primary hover:underline"
            >
              Reset All Filters
            </button>
          )}
        </div>
      )
    }
    return (
      <div className="p-4 sm:p-8">
        <EmptyState />
      </div>
    )
  }

  return (
    <>
      {/* Desktop Table View (md and above) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border/70 text-[10px] font-mono uppercase tracking-[0.16em] text-muted-foreground/80">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Intent ID & Ref</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Requirement</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Created</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Expires</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {intents.map((intent) => {
              const formattedDate = new Date(intent.createdAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
              const formattedExpiry = intent.conditions.expiresAt
                ? new Date(intent.conditions.expiresAt).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Never'

              const isExpired =
                intent.conditions.expiresAt &&
                new Date(intent.conditions.expiresAt).getTime() < Date.now()

              return (
                <tr
                  key={intent.id}
                  className="group transition hover:bg-secondary/40"
                >
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <PaymentIntentStatusBadge status={intent.status} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <div className="flex items-center gap-1.5 font-mono">
                      <Link
                        href={`/app/intents/${intent.id}`}
                        className="relative block max-w-[170px] truncate font-mono font-semibold text-foreground"
                        title={intent.id}
                      >
                        {/* Signature motif: the ID is redacted until hover */}
                        <span
                          aria-hidden="true"
                          className="veil-redact absolute inset-0 py-1 text-primary/60 opacity-100 transition-opacity duration-200 group-hover:opacity-0"
                        />
                        <span className="opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          {intent.id}
                        </span>
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => handleCopyId(intent.id, e)}
                        aria-label="Copy intent ID"
                        title="Copy Intent ID"
                        className="text-muted-foreground hover:text-foreground transition p-0.5 rounded"
                      >
                        {copiedId === intent.id ? (
                          <Check className="size-3 text-accent" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                      </button>
                    </div>
                    {intent.conditions.reference && (
                      <p className="font-sans text-[11px] text-muted-foreground truncate max-w-[200px]">
                        Ref: {intent.conditions.reference}
                      </p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-foreground font-sans">
                    <div className="font-medium">
                      {describeAmountCondition(intent.conditions)}
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      Asset: {intent.conditions.amount.asset}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground font-sans">
                    {formattedDate}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground font-sans">
                    <span className={isExpired && intent.status === 'awaiting_payment' ? 'text-warning font-medium' : ''}>
                      {formattedExpiry}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <PaymentIntentRowActions
                      intent={intent}
                      onCancelClick={(target) => setIntentToCancel(target)}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (below md) */}
      <div className="block md:hidden divide-y divide-border/60">
        {intents.map((intent) => {
          const formattedDate = new Date(intent.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
          const formattedExpiry = intent.conditions.expiresAt
            ? new Date(intent.conditions.expiresAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Never'

          return (
            <div key={intent.id} className="p-4 space-y-3 transition hover:bg-card/40">
              {/* Header: Status and Timestamp */}
              <div className="flex items-center justify-between gap-2">
                <PaymentIntentStatusBadge status={intent.status} />
                <span className="text-[11px] text-muted-foreground">{formattedDate}</span>
              </div>

              {/* ID & Reference */}
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <Link
                    href={`/app/intents/${intent.id}`}
                    className="font-mono text-xs font-semibold text-foreground hover:underline break-all"
                  >
                    {intent.id}
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => handleCopyId(intent.id, e)}
                    className="text-muted-foreground hover:text-foreground shrink-0 p-1"
                    aria-label="Copy intent ID"
                  >
                    {copiedId === intent.id ? (
                      <Check className="size-3.5 text-accent" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
                {intent.conditions.reference && (
                  <p className="text-[11px] text-muted-foreground">
                    Ref: <span className="font-mono text-foreground">{intent.conditions.reference}</span>
                  </p>
                )}
              </div>

              {/* Condition & Expiration */}
              <div className="grid grid-cols-2 gap-2 rounded-lg border border-border/50 bg-muted/20 p-2.5 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Requirement
                  </span>
                  <span className="font-medium text-foreground">
                    {describeAmountCondition(intent.conditions)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block">
                    Expires
                  </span>
                  <span className="text-muted-foreground">{formattedExpiry}</span>
                </div>
              </div>

              {/* Mobile Actions Bar */}
              <div className="pt-1 flex items-center justify-between border-t border-border/40">
                <span className="text-[11px] font-mono text-muted-foreground">Actions:</span>
                <PaymentIntentRowActions
                  intent={intent}
                  compact={false}
                  onCancelClick={(target) => setIntentToCancel(target)}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* Cancel Confirmation Modal Dialog */}
      <PaymentIntentCancelDialog
        intent={intentToCancel}
        isOpen={Boolean(intentToCancel)}
        onClose={() => setIntentToCancel(null)}
        onSuccess={(updated) => {
          onIntentUpdated?.(updated)
        }}
      />
    </>
  )
}
