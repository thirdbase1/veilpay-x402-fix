'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardHeader } from '@/components/dashboard/header'
import { MetricCard } from '@/components/dashboard/metric-card'
import { PaymentIntentTable } from '@/components/dashboard/payment-intent-table'
import { fetchPaymentIntents, fetchDashboardMetrics } from '@/lib/payments/service'
import type { PaymentIntent, DashboardMetrics, PaymentIntentStatus } from '@/lib/payments/types'
import {
  Clock,
  CheckCircle2,
  RefreshCw,
  AlertTriangle,
  ShieldCheck,
  ArrowRight,
  Search,
  X,
} from 'lucide-react'

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

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
        {/* Error notification if protocol query fails */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300 flex items-center justify-between"
          >
            <div>
              <p className="font-semibold">Unable to fetch protocol state</p>
              <p className="mt-1 text-rose-400/90">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => loadData(false)}
              className="font-mono text-xs underline text-rose-300 hover:text-rose-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Real Summary Metric Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <MetricCard
            title="Active Payment Intents"
            value={metrics?.activeCount ?? 0}
            subtext="Awaiting customer proof"
            icon={<Clock className="size-4 text-primary" />}
            isLoading={isLoading}
          />

          <MetricCard
            title="Verified Payments"
            value={metrics?.verifiedCount ?? 0}
            subtext="Satisfied conditions"
            icon={<CheckCircle2 className="size-4 text-accent" />}
            isLoading={isLoading}
          />

          <MetricCard
            title="Pending Verification"
            value={metrics?.pendingCount ?? 0}
            subtext="Zero-knowledge proof in progress"
            icon={<RefreshCw className="size-4 text-warning" />}
            isLoading={isLoading}
          />

          <MetricCard
            title="Expired Intents"
            value={metrics?.expiredCount ?? 0}
            subtext="Unsatisfied within deadline"
            icon={<AlertTriangle className="size-4 text-destructive" />}
            isLoading={isLoading}
          />
        </div>

        {/* Recent Payment Intents Section */}
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/30 backdrop-blur-sm">
          <div className="flex flex-col gap-3 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-sm font-semibold tracking-tight text-foreground">
                  Recent Payment Intents
                </h2>
                <span className="rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                  {intents.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Authoritative payment intents registered in VeilPay.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={isLoading || isRefreshing}
                aria-label="Refresh intents"
                title="Refresh intent list"
                className="inline-flex size-8 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50"
              >
                <RefreshCw
                  className={`size-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`}
                />
              </button>

              <Link
                href="/app/intents"
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition"
              >
                <span>View All Intents</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          {/* Quick Search & Status Pills if intents exist */}
          {intents.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-b border-border/50 bg-muted/10 p-3 sm:px-6">
              {/* Search input */}
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter recent intents..."
                  className="w-full rounded-lg border border-border/70 bg-background/80 pl-8 pr-7 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar font-mono text-[11px]">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'awaiting_payment', label: 'Awaiting Payment' },
                    { id: 'verified', label: 'Verified' },
                    { id: 'expired', label: 'Expired' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStatusFilter(s.id)}
                    className={`rounded-md px-2 py-0.5 transition ${
                      statusFilter === s.id
                        ? 'bg-secondary font-medium text-foreground border border-border'
                        : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

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
      </main>
    </DashboardLayout>
  )
}
