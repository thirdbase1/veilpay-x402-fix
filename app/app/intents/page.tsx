'use client'

import { useEffect, useState, useCallback, useTransition } from 'react'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardHeader } from '@/components/dashboard/header'
import { PaymentIntentTable } from '@/components/dashboard/payment-intent-table'
import { listPaymentIntents } from '@/lib/payments/service'
import type { PaymentIntent, PaymentIntentStatus } from '@/lib/payments/types'
import {
  Search,
  Filter,
  ArrowUpDown,
  RefreshCw,
  ReceiptText,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react'

const STATUS_FILTERS: { id: 'all' | PaymentIntentStatus; label: string }[] = [
  { id: 'all', label: 'All Intents' },
  { id: 'awaiting_payment', label: 'Awaiting Payment' },
  { id: 'verifying', label: 'Verifying' },
  { id: 'verified', label: 'Verified' },
  { id: 'expired', label: 'Expired' },
  { id: 'failed', label: 'Failed' },
  { id: 'cancelled', label: 'Cancelled' },
]

const SORT_OPTIONS: { id: string; label: string }[] = [
  { id: 'newest', label: 'Newest First' },
  { id: 'oldest', label: 'Oldest First' },
  { id: 'amount_desc', label: 'Amount: High to Low' },
  { id: 'amount_asc', label: 'Amount: Low to High' },
  { id: 'expires_asc', label: 'Expiration Date' },
  { id: 'status', label: 'Status' },
]

export default function PaymentIntentsListPage() {
  const [intents, setIntents] = useState<PaymentIntent[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | PaymentIntentStatus>('all')
  const [sortBy, setSortBy] = useState('newest')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  const loadData = useCallback(
    async (showRefreshIndicator = false) => {
      try {
        if (showRefreshIndicator) {
          setIsRefreshing(true)
        } else {
          setIsLoading(true)
        }
        setError(null)

        const result = await listPaymentIntents({
          search: debouncedSearch,
          status: statusFilter,
          sort: sortBy as any,
          page,
          pageSize,
        })

        setIntents(result.intents)
        setTotalCount(result.total)
        setTotalPages(result.totalPages)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve payment intents'
        setError(msg)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [debouncedSearch, statusFilter, sortBy, page, pageSize],
  )

  useEffect(() => {
    loadData()
  }, [loadData])

  // Real-time: silent refresh every 5s while the tab is visible so payment
  // status changes (paid, expired, cancelled) appear without a manual reload.
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const result = await listPaymentIntents({
          search: debouncedSearch,
          status: statusFilter,
          sort: sortBy as any,
          page,
          pageSize,
        })
        startTransition(() => {
          setIntents(result.intents)
          setTotalCount(result.total)
          setTotalPages(result.totalPages)
        })
      } catch {
        // Keep the last good data on transient failures.
      }
    }, 5000)
    return () => clearInterval(id)
  }, [debouncedSearch, statusFilter, sortBy, page, pageSize])

  const handleResetFilters = () => {
    setSearch('')
    setDebouncedSearch('')
    setStatusFilter('all')
    setSortBy('newest')
    setPage(1)
  }

  const handleIntentUpdated = (updated: PaymentIntent) => {
    startTransition(() => {
      setIntents((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item)),
      )
    })
  }

  const isFiltered =
    Boolean(debouncedSearch.trim()) || statusFilter !== 'all' || sortBy !== 'newest'

  return (
    <DashboardLayout>
      <DashboardHeader
        title="Payment Intents"
        description="Search, filter, monitor, and cancel privacy-preserving payment intents."
        action={{ href: '/app/create', label: 'Create Payment' }}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
        {/* Error notification if protocol query fails */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 text-xs text-rose-300 flex items-start justify-between"
          >
            <div>
              <p className="font-semibold">Unable to fetch protocol state</p>
              <p className="mt-1 text-rose-400/90">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => loadData(false)}
              className="font-mono text-xs text-rose-300 underline hover:text-rose-200"
            >
              Retry
            </button>
          </div>
        )}

        {/* Filter, Search & Sort Control Panel */}
        <div className="rounded-2xl border border-border/70 bg-card/40 p-4 sm:p-5 backdrop-blur-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by intent ID, reference, recipient..."
                className="w-full rounded-xl border border-border/80 bg-background/80 pl-9 pr-9 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Controls: Sort, Page Size, Refresh */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Sort Selector */}
              <div className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-background/80 px-2.5 py-1 text-xs text-muted-foreground">
                <ArrowUpDown className="size-3.5 text-muted-foreground shrink-0" />
                <span className="hidden sm:inline font-sans text-[11px]">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value)
                    setPage(1)
                  }}
                  className="bg-transparent font-medium text-foreground focus:outline-none text-xs cursor-pointer"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id} className="bg-popover text-popover-foreground">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={() => loadData(true)}
                disabled={isLoading || isRefreshing}
                aria-label="Refresh intents from server"
                title="Refresh intent list"
                className="inline-flex size-8 items-center justify-center rounded-xl border border-border/80 bg-background/80 text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50"
              >
                <RefreshCw
                  className={`size-3.5 ${isRefreshing ? 'animate-spin text-primary' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* Status Filter Pills */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/50 overflow-x-auto no-scrollbar">
            <Filter className="size-3.5 text-muted-foreground shrink-0" />
            <div className="flex items-center gap-1.5 font-mono text-[11px] whitespace-nowrap">
              {STATUS_FILTERS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => {
                    setStatusFilter(opt.id)
                    setPage(1)
                  }}
                  className={`rounded-lg px-2.5 py-1 transition ${
                    statusFilter === opt.id
                      ? 'bg-secondary font-semibold text-foreground border border-border shadow-xs'
                      : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Intents Container */}
        <div className="rounded-2xl border border-border/70 bg-card/40 backdrop-blur-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border/70 p-4 sm:px-6">
            <div className="flex items-center gap-2">
              <ReceiptText className="size-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                Registered Intents
              </h2>
              <span className="rounded-full bg-muted/60 px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                {totalCount} total
              </span>
            </div>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px]">
                <ShieldCheck className="size-3 text-primary" />
                Zero-Knowledge Privacy
              </span>
            </div>
          </div>

          {/* Table / Cards View */}
          <PaymentIntentTable
            intents={intents}
            isLoading={isLoading}
            isFiltered={isFiltered}
            onResetFilters={handleResetFilters}
            onIntentUpdated={handleIntentUpdated}
          />

          {/* Pagination Controls */}
          {totalCount > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/70 px-4 py-3 sm:px-6 text-xs text-muted-foreground bg-muted/10">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value))
                    setPage(1)
                  }}
                  className="rounded-lg border border-border/80 bg-background px-2 py-1 text-xs text-foreground cursor-pointer focus:outline-none"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                </select>
                <span className="text-muted-foreground/70 hidden sm:inline">
                  Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalCount)} of {totalCount}
                </span>
              </div>

              <div className="flex items-center gap-2 font-mono">
                <span className="text-[11px]">
                  Page {page} of {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1 || isLoading}
                    aria-label="Previous page"
                    className="flex size-7 items-center justify-center rounded-lg border border-border/80 bg-background text-foreground hover:bg-muted transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages || isLoading}
                    aria-label="Next page"
                    className="flex size-7 items-center justify-center rounded-lg border border-border/80 bg-background text-foreground hover:bg-muted transition disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </DashboardLayout>
  )
}
