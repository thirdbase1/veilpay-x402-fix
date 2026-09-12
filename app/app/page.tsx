'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardHeader } from '@/components/dashboard/header'
import { MetricLedger } from '@/components/dashboard/metric-ledger'
import { PaymentIntentTable } from '@/components/dashboard/payment-intent-table'
import { fetchPaymentIntents, fetchDashboardMetrics } from '@/lib/payments/service'
import type { PaymentIntent, DashboardMetrics, PaymentIntentStatus } from '@/lib/payments/types'
import { RefreshCw, ArrowRight, Search, X } from 'lucide-react'

export default function MerchantOverviewPage() {
  const [intents, setIntents] = useState<PaymentIntent[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentIntentStatus>('all')

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      setError(null)
      if (isRefresh) {
        setIsRefreshing(true)
      } else {
        setIsLoading(true)
      }
      const [fetchedIntents, fetchedMetrics] = await Promise.all([
        fetchPaymentIntents({ pageSize: 15 }),
        fetchDashboardMetrics(),
      ])
      setIntents(fetchedIntents)
      setMetrics(fetchedMetrics)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve intents'
      setError(msg)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Real-time: silent refresh every 5s while the tab is visible so metrics
  // and the recent-intents table track live payment state.
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const [fetchedIntents, fetchedMetrics] = await Promise.all([
          fetchPaymentIntents({ pageSize: 15 }),
          fetchDashboardMetrics(),
        ])
        setIntents(fetchedIntents)
        setMetrics(fetchedMetrics)
      } catch {
        // Keep the last good data on transient failures.
      }
    }, 5000)
    return () => clearInterval(id)
  }, [])

  const handleIntentUpdated = (updated: PaymentIntent) => {
    setIntents((prev) =>
      prev.map((item) => (item.id === updated.id ? updated : item)),
    )
    // Refresh metrics in background
    fetchDashboardMetrics()
      .then(setMetrics)
      .catch(() => {})
  }

  // Filtered recent intents for quick overview
  const filteredIntents = useMemo(() => {
    let list = intents
    if (statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter)
    }
    if (search.trim()) {
      const s = search.toLowerCase()
      list = list.filter(
        (i) =>
          i.id.toLowerCase().includes(s) ||
          i.conditions.reference?.toLowerCase().includes(s) ||
          i.conditions.recipient.toLowerCase().includes(s),
      )
    }
    return list
  }, [intents, statusFilter, search])

  const isFiltered = statusFilter !== 'all' || Boolean(search.trim())

  return (
    <DashboardLayout>
      <DashboardHeader
        title="Overview"
        description="Create, monitor, and manage privacy-preserving payment intents."
        action={{ href: '/app/create', label: 'Create Payment' }}
      />

      <main className="relative flex-1 overflow-y-auto">
        {/* Cryptographic grid texture, fading out down the page */}
        <div
          aria-hidden="true"
          className="veil-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent_45%)]"
        />

        <div className="relative space-y-10 p-4 sm:p-8">
          {/* Error notification if protocol query fails */}
          {error && (
            <div
              role="alert"
              className="flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/15 p-4 text-xs text-destructive"
            >
              <div>
                <p className="font-semibold">Unable to fetch protocol state</p>
                <p className="mt-1 text-destructive/90">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => loadData(false)}
                className="font-mono text-xs underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {/* Ledger strip */}
          <section aria-labelledby="ledger-kicker">
            <div className="mb-3 flex items-baseline justify-between gap-4">
              <h2
                id="ledger-kicker"
                className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
              >
                Ledger
              </h2>
              <span className="font-mono text-[10px] text-muted-foreground/60">
                live &middot; 5s sync
              </span>
            </div>
            <MetricLedger
              isLoading={isLoading}
              items={[
                {
                  label: 'Active Intents',
                  value: metrics?.activeCount ?? 0,
                  subtext: 'Awaiting customer proof',
                  tone: 'primary',
                },
                {
                  label: 'Verified',
                  value: metrics?.verifiedCount ?? 0,
                  subtext: 'Conditions satisfied',
                  tone: 'accent',
                },
                {
                  label: 'Proving',
                  value: metrics?.pendingCount ?? 0,
                  subtext: 'Zero-knowledge proof in progress',
                  tone: 'warning',
                },
                {
                  label: 'Expired',
                  value: metrics?.expiredCount ?? 0,
                  subtext: 'Unsatisfied within deadline',
                  tone: 'destructive',
                },
              ]}
            />
          </section>

          {/* Recent intents */}
          <section aria-labelledby="recent-kicker">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-baseline gap-3">
                <h2
                  id="recent-kicker"
                  className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
                >
                  Recent Intents
                </h2>
                <span className="font-mono text-[11px] text-muted-foreground/70">
                  {intents.length}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadData(true)}
                  disabled={isLoading || isRefreshing}
                  aria-label="Refresh intents"
                  title="Refresh intent list"
                  className="inline-flex size-8 items-center justify-center rounded-lg border border-border/70 bg-background/60 text-muted-foreground transition hover:border-primary/40 hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw
                    className={`size-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`}
                  />
                </button>

                <Link
                  href="/app/intents"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-background/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-foreground transition hover:border-primary/40"
                >
                  <span>View All</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>

            {/* Quick Search & Status Pills if intents exist */}
            {intents.length > 0 && (
              <div className="mb-3 flex flex-col items-stretch justify-between gap-2.5 sm:flex-row sm:items-center">
                {/* Search input */}
                <div className="relative max-w-xs flex-1">
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filter recent intents..."
                    className="w-full rounded-lg border border-border/70 bg-background/60 py-1.5 pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label="Clear search"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>

                {/* Status pills */}
                <div className="no-scrollbar flex items-center gap-1 overflow-x-auto font-mono text-[11px]">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'awaiting_payment', label: 'Awaiting' },
                      { id: 'verified', label: 'Verified' },
                      { id: 'expired', label: 'Expired' },
                    ] as const
                  ).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStatusFilter(s.id)}
                      className={`rounded-md px-2 py-0.5 uppercase tracking-wider transition ${
                        statusFilter === s.id
                          ? 'bg-secondary font-medium text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="veil-enter overflow-hidden rounded-xl border border-border/60 bg-card/30">
              <PaymentIntentTable
                intents={filteredIntents}
                isLoading={isLoading}
                isFiltered={isFiltered}
                onResetFilters={() => {
                  setSearch('')
                  setStatusFilter('all')
                }}
                onIntentUpdated={handleIntentUpdated}
              />
            </div>
          </section>
        </div>
      </main>
    </DashboardLayout>
  )
}
