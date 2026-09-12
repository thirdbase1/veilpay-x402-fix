'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardHeader } from '@/components/dashboard/header'
import {
  Activity,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Search,
  RefreshCw,
  CheckCheck,
  Filter,
  Loader2,
  ReceiptText,
} from 'lucide-react'
import type { ActivityRecord, ActivityEventType } from '@/lib/payments/types'

const EVENT_TYPE_OPTIONS: { label: string; value: string }[] = [
  { label: 'All Events', value: 'ALL' },
  { label: 'Intent Created', value: 'PAYMENT_INTENT_CREATED' },
  { label: 'Intent Cancelled', value: 'PAYMENT_INTENT_CANCELLED' },
  { label: 'Payment Verified', value: 'PAYMENT_VERIFIED' },
  { label: 'Verification Started', value: 'VERIFICATION_STARTED' },
  { label: 'Payment Detected', value: 'PAYMENT_DETECTED' },
  { label: 'Intent Expired', value: 'PAYMENT_INTENT_EXPIRED' },
  { label: 'Payment Failed', value: 'PAYMENT_FAILED' },
]

function formatRelativeTime(dateString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
    if (diff < 30) return 'Just now'
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) {
      const m = Math.floor(diff / 60)
      return `${m} ${m === 1 ? 'minute' : 'minutes'} ago`
    }
    if (diff < 86400) {
      const h = Math.floor(diff / 3600)
      return `${h} ${h === 1 ? 'hour' : 'hours'} ago`
    }
    if (diff < 604800) {
      const d = Math.floor(diff / 86400)
      return `${d} ${d === 1 ? 'day' : 'days'} ago`
    }
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'Recently'
  }
}

function formatExactDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'medium',
    })
  } catch {
    return dateString
  }
}

function getEventBadge(type: ActivityEventType) {
  switch (type) {
    case 'PAYMENT_INTENT_CREATED':
      return {
        label: 'Created',
        icon: <PlusCircle className="size-3.5 text-primary" />,
        badgeClass: 'border-primary/30 bg-primary/10 text-primary',
      }
    case 'PAYMENT_VERIFIED':
      return {
        label: 'Verified',
        icon: <CheckCircle2 className="size-3.5 text-accent" />,
        badgeClass: 'border-accent/30 bg-accent/10 text-accent',
      }
    case 'PAYMENT_INTENT_CANCELLED':
      return {
        label: 'Cancelled',
        icon: <XCircle className="size-3.5 text-warning" />,
        badgeClass: 'border-warning/30 bg-warning/10 text-warning',
      }
    case 'PAYMENT_INTENT_EXPIRED':
      return {
        label: 'Expired',
        icon: <Clock className="size-3.5 text-muted-foreground" />,
        badgeClass: 'border-border bg-muted/40 text-muted-foreground',
      }
    case 'VERIFICATION_STARTED':
      return {
        label: 'Verifying',
        icon: <ShieldCheck className="size-3.5 text-primary" />,
        badgeClass: 'border-primary/30 bg-primary/10 text-primary',
      }
    case 'PAYMENT_DETECTED':
      return {
        label: 'Detected',
        icon: <Activity className="size-3.5 text-primary" />,
        badgeClass: 'border-primary/30 bg-primary/10 text-primary',
      }
    case 'PAYMENT_FAILED':
      return {
        label: 'Failed',
        icon: <AlertTriangle className="size-3.5 text-destructive" />,
        badgeClass: 'border-destructive/30 bg-destructive/10 text-destructive',
      }
    default:
      return {
        label: type,
        icon: <Activity className="size-3.5 text-muted-foreground" />,
        badgeClass: 'border-border bg-muted/40 text-muted-foreground',
      }
  }
}

export default function MerchantActivityPage() {
  const [activities, setActivities] = useState<ActivityRecord[]>([])
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL')
  const [searchIntent, setSearchIntent] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [unreadCount, setUnreadCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isMarkingAll, setIsMarkingAll] = useState(false)

  const fetchActivities = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true)
      else setIsRefreshing(true)

      try {
        const params = new URLSearchParams()
        if (eventTypeFilter !== 'ALL') params.set('eventType', eventTypeFilter)
        if (searchIntent.trim()) params.set('intentId', searchIntent.trim())
        params.set('page', String(page))
        params.set('limit', '15')

        const res = await fetch(`/api/activity?${params.toString()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Failed to load activity records')
        const data = await res.json()

        setActivities(Array.isArray(data.activities) ? data.activities : [])
        setTotal(typeof data.total === 'number' ? data.total : 0)
        setTotalPages(typeof data.totalPages === 'number' ? data.totalPages : 1)
        setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0)
      } catch (err) {
        console.warn('[VeilPay] Activity fetch note:', err)
      } finally {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    },
    [eventTypeFilter, searchIntent, page],
  )

  useEffect(() => {
    fetchActivities()
  }, [fetchActivities])

  // Real-time: silent refresh every 5s while the tab is visible so new
  // payment events appear without a manual reload.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') fetchActivities(false)
    }, 5000)
    return () => clearInterval(id)
  }, [fetchActivities])

  const handleMarkAllRead = async () => {
    if (isMarkingAll || unreadCount === 0) return
    setIsMarkingAll(true)
    try {
      const res = await fetch('/api/activity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      })
      if (res.ok) {
        setUnreadCount(0)
        setActivities((prev) => prev.map((a) => ({ ...a, isRead: true })))
      }
    } finally {
      setIsMarkingAll(false)
    }
  }

  const handleMarkOneRead = async (id: string) => {
    try {
      await fetch('/api/activity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: id }),
      })
      setActivities((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: true } : a)))
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      // Ignore
    }
  }

  return (
    <DashboardLayout>
      <div className="flex flex-1 flex-col min-w-0">
        <DashboardHeader
          title="Activity & Audit Log"
          description="Authoritative timeline of payment intent creation, verification, and settlement events."
          action={{ href: '/app/create', label: 'Create Payment' }}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
          {/* Top Banner / Controls */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Activity className="size-5 text-primary shrink-0" />
                <span>Merchant Activity Log</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time cryptographic audit trail of all actions performed on your payment intents.
              </p>
            </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={isMarkingAll}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted/40 transition disabled:opacity-50"
            >
              {isMarkingAll ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <CheckCheck className="size-3.5 text-primary" />
              )}
              <span>Mark All Read</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => fetchActivities(false)}
            disabled={isRefreshing}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition disabled:opacity-50"
            title="Refresh activity"
            aria-label="Refresh activity"
          >
            <RefreshCw className={`size-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-border bg-card/60 p-4 backdrop-blur-sm space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
          {/* Search by intent ID */}
          <div className="sm:col-span-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchIntent}
              onChange={(e) => {
                setSearchIntent(e.target.value)
                setPage(1)
              }}
              placeholder="Filter by Intent ID (e.g. pi_...)"
              className="w-full h-9 rounded-lg border border-border bg-background/80 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Event type filter dropdown */}
          <div className="sm:col-span-6 flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground shrink-0 hidden sm:block" />
            <select
              value={eventTypeFilter}
              onChange={(e) => {
                setEventTypeFilter(e.target.value)
                setPage(1)
              }}
              className="w-full h-9 rounded-lg border border-border bg-background/80 px-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Activity List Container */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary mb-3" />
            <p className="text-xs font-medium text-foreground">Loading merchant activity...</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Querying authoritative audit records.
            </p>
          </div>
        ) : activities.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-muted/40 text-muted-foreground mb-3">
              <Activity className="size-6" />
            </div>
            <h3 className="text-sm font-semibold text-foreground">No activity yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              Payment-intent lifecycle events, verification attempts, and cancellations will appear
              here as your merchant account processes transactions.
            </p>
            <div className="mt-5">
              <Link
                href="/app/create"
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition shadow-sm"
              >
                <PlusCircle className="size-3.5" />
                <span>Create First Payment Intent</span>
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {activities.map((item) => {
              const badge = getEventBadge(item.eventType)
              return (
                <div
                  key={item.id}
                  className={`group relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 transition hover:bg-muted/30 ${
                    !item.isRead ? 'bg-primary/5' : ''
                  }`}
                >
                  {/* Event Details */}
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-0.5 shrink-0">{badge.icon}</div>

                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {item.title}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium ${badge.badgeClass}`}
                        >
                          {badge.label}
                        </span>
                        {!item.isRead && (
                          <span className="inline-flex size-2 rounded-full bg-primary ring-2 ring-primary/20 shrink-0" />
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {item.description}
                      </p>

                      {/* Safe metadata tags */}
                      {item.metadata && Object.keys(item.metadata).length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {typeof item.metadata.amount === 'string' && (
                            <span className="font-mono text-[10px] text-foreground/80 bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                              {item.metadata.amount} {String(item.metadata.asset || 'tDUST')}
                            </span>
                          )}
                          {typeof item.metadata.reference === 'string' &&
                            item.metadata.reference && (
                              <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded border border-border/40">
                                Ref: {item.metadata.reference}
                              </span>
                            )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Timestamp */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:shrink-0 pt-2 sm:pt-0 border-t border-border/30 sm:border-0">
                    <div className="text-left sm:text-right">
                      <div
                        className="font-mono text-[11px] text-muted-foreground"
                        title={formatExactDate(item.createdAt)}
                      >
                        {formatRelativeTime(item.createdAt)}
                      </div>
                      <div className="text-[10px] text-muted-foreground/60 hidden sm:block">
                        {formatExactDate(item.createdAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.intentId && (
                        <Link
                          href={`/app/intents/${item.intentId}`}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[11px] font-medium text-foreground hover:bg-muted/40 hover:text-primary transition"
                        >
                          <ReceiptText className="size-3 text-muted-foreground" />
                          <span>View Intent</span>
                          <ExternalLink className="size-2.5 text-muted-foreground" />
                        </Link>
                      )}

                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkOneRead(item.id)}
                          className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition"
                          title="Mark as read"
                          aria-label="Mark as read"
                        >
                          <CheckCheck className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border/70 px-4 py-3 bg-muted/10">
            <span className="text-xs text-muted-foreground">
              Showing page <span className="font-semibold text-foreground">{page}</span> of{' '}
              <span className="font-semibold text-foreground">{totalPages}</span> ({total} total)
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex h-8 items-center rounded-lg border border-border bg-card px-3 text-xs font-medium text-foreground hover:bg-muted/40 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
        </main>
      </div>
    </DashboardLayout>
  )
}
