'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardHeader } from '@/components/dashboard/header'
import { MetricCard } from '@/components/dashboard/metric-card'
import { PaymentIntentTable } from '@/components/dashboard/payment-intent-table'
import { EmptyState } from '@/components/dashboard/empty-state'
import { fetchPaymentIntents, fetchDashboardMetrics } from '@/lib/payments/service'
import type { PaymentIntent, DashboardMetrics } from '@/lib/payments/types'
import { Clock, CheckCircle2, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react'

export default function MerchantOverviewPage() {
  const [intents, setIntents] = useState<PaymentIntent[]>([])
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setError(null)
      const [fetchedIntents, fetchedMetrics] = await Promise.all([
        fetchPaymentIntents(),
        fetchDashboardMetrics(),
      ])
      setIntents(fetchedIntents)
      setMetrics(fetchedMetrics)
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

  return (
    <DashboardLayout>
      <DashboardHeader
        title="Overview"
        description="Create and monitor privacy-preserving payment intents."
        action={{ href: '/app/create', label: 'Create payment' }}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
        {/* Error notification if protocol query fails */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300"
          >
            <p className="font-semibold">Unable to fetch protocol state</p>
            <p className="mt-1 text-rose-400/90">{error}</p>
            <button
              type="button"
              onClick={() => {
                setIsLoading(true)
                loadData()
              }}
              className="mt-2 font-mono text-[11px] underline hover:text-rose-200"
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
            icon={<Clock className="size-4 text-cyan-400" />}
            isLoading={isLoading}
          />

          <MetricCard
            title="Verified Payments"
            value={metrics?.verifiedCount ?? 0}
            subtext="Satisfied conditions"
            icon={<CheckCircle2 className="size-4 text-emerald-400" />}
            isLoading={isLoading}
          />

          <MetricCard
            title="Pending Verification"
            value={metrics?.pendingCount ?? 0}
            subtext="Zero-knowledge proof in progress"
            icon={<RefreshCw className="size-4 text-amber-400" />}
            isLoading={isLoading}
          />

          <MetricCard
            title="Expired Intents"
            value={metrics?.expiredCount ?? 0}
            subtext="Unsatisfied within deadline"
            icon={<AlertTriangle className="size-4 text-zinc-400" />}
            isLoading={isLoading}
          />
        </div>

        {/* Recent Payment Intents Section */}
        <div className="rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-border/70 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <div>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Recent Payment Intents
              </h2>
              <p className="text-xs text-muted-foreground">
                Real payment intents registered in the VeilPay protocol store.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3 text-primary" />
                Zero-Knowledge Privacy
              </span>
            </div>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              <div className="inline-block size-5 animate-spin rounded-full border-2 border-primary border-t-transparent mb-2" />
              <p>Loading payment intents from protocol state...</p>
            </div>
          ) : intents.length === 0 ? (
            <div className="p-6 sm:p-8">
              <EmptyState />
            </div>
          ) : (
            <PaymentIntentTable intents={intents} />
          )}
        </div>
      </main>
    </DashboardLayout>
  )
}
