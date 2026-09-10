'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardHeader } from '@/components/dashboard/header'
import { PaymentIntentTable } from '@/components/dashboard/payment-intent-table'
import { EmptyState } from '@/components/dashboard/empty-state'
import { fetchPaymentIntents } from '@/lib/payments/service'
import type { PaymentIntent, PaymentIntentStatus } from '@/lib/payments/types'
import { Filter, ReceiptText } from 'lucide-react'

export default function PaymentIntentsListPage() {
  const [intents, setIntents] = useState<PaymentIntent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | PaymentIntentStatus>('all')

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const data = await fetchPaymentIntents()
      setIntents(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve intents'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const filteredIntents = useMemo(() => {
    if (filter === 'all') return intents
    return intents.filter((i) => i.status === filter)
  }, [intents, filter])

  return (
    <DashboardLayout>
      <DashboardHeader
        title="Payment Intents"
        description="Filter and inspect privacy-preserving payment intents."
        action={{ href: '/app/create', label: 'Create payment' }}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300"
          >
            <p className="font-semibold">Unable to fetch protocol state</p>
            <p className="mt-1 text-rose-400/90">{error}</p>
          </div>
        )}

        {/* Filter controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card/40 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Filter className="size-3.5 text-muted-foreground" />
            <span className="font-medium text-foreground">Filter by status:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
            {(
              [
                { id: 'all', label: 'All Intents' },
                { id: 'awaiting_payment', label: 'Awaiting Payment' },
                { id: 'verifying', label: 'Verifying' },
                { id: 'verified', label: 'Verified' },
                { id: 'expired', label: 'Expired' },
                { id: 'cancelled', label: 'Cancelled' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setFilter(opt.id)}
                className={`rounded-lg px-2.5 py-1 transition ${
                  filter === opt.id
                    ? 'bg-secondary font-semibold text-foreground border border-border'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Intents Container */}
        <div className="rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-border/70 p-4 sm:px-6">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Registered Intents ({filteredIntents.length})
              </h2>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <div className="inline-block size-5 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
              <p>Loading payment intents...</p>
            </div>
          ) : filteredIntents.length === 0 ? (
            <div className="p-6 sm:p-8">
              <EmptyState />
            </div>
          ) : (
            <PaymentIntentTable intents={filteredIntents} />
          )}
        </div>
      </main>
    </DashboardLayout>
  )
}
