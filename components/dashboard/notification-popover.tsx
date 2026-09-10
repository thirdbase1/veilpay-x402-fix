'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import {
  Bell,
  CheckCircle2,
  XCircle,
  Clock,
  PlusCircle,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  CheckCheck,
  Loader2,
} from 'lucide-react'
import type { ActivityRecord, ActivityEventType } from '@/lib/payments/types'

function formatRelativeTime(dateString: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
    if (diff < 30) return 'Just now'
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
    return new Date(dateString).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return 'Recently'
  }
}

function getEventIcon(type: ActivityEventType) {
  switch (type) {
    case 'PAYMENT_INTENT_CREATED':
      return <PlusCircle className="size-4 text-primary shrink-0" />
    case 'PAYMENT_VERIFIED':
      return <CheckCircle2 className="size-4 text-emerald-400 shrink-0" />
    case 'PAYMENT_INTENT_CANCELLED':
      return <XCircle className="size-4 text-amber-400 shrink-0" />
    case 'PAYMENT_INTENT_EXPIRED':
      return <Clock className="size-4 text-muted-foreground shrink-0" />
    case 'VERIFICATION_STARTED':
      return <ShieldCheck className="size-4 text-sky-400 shrink-0" />
    case 'PAYMENT_FAILED':
      return <AlertTriangle className="size-4 text-destructive shrink-0" />
    default:
      return <Bell className="size-4 text-muted-foreground shrink-0" />
  }
}

export function NotificationPopover() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<ActivityRecord[]>([])
  const [unreadCount, setUnreadCount] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?limit=6', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (Array.isArray(data.activities)) {
        setNotifications(data.activities)
        setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0)
      }
    } catch {
      // Ignore background fetch error
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
    // Controlled polling every 20 seconds
    const interval = setInterval(fetchNotifications, 20000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click or Escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

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
        setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
      }
    } catch {
      // Error handling
    } finally {
      setIsMarkingAll(false)
    }
  }

  const handleMarkOneRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await fetch('/api/activity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId: id }),
      })
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      )
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      // Ignore
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen)
          if (!isOpen) {
            setIsLoading(true)
            fetchNotifications().finally(() => setIsLoading(false))
          }
        }}
        className="relative inline-flex size-9 items-center justify-center rounded-lg border border-border/80 bg-secondary/50 text-foreground/80 hover:bg-secondary hover:text-foreground transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-primary font-mono text-[9px] font-bold text-primary-foreground shadow-sm animate-in fade-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-border bg-card/95 p-0 shadow-2xl backdrop-blur-xl z-50 animate-in fade-in zoom-in-95 duration-100"
          role="dialog"
          aria-label="Notification center"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                Activity Alerts
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-medium text-primary">
                  {unreadCount} unread
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                disabled={isMarkingAll}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition disabled:opacity-50"
              >
                {isMarkingAll ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <CheckCheck className="size-3" />
                )}
                <span>Mark All Read</span>
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-border/40">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin mr-2" />
                <span>Loading activity...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <p className="text-xs text-muted-foreground">No recent notifications</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  onClick={(e) => handleMarkOneRead(item.id, e)}
                  className={`flex items-start gap-3 p-3 transition hover:bg-muted/40 cursor-pointer ${
                    !item.isRead ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="mt-0.5">{getEventIcon(item.eventType)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-medium text-foreground truncate">
                        {item.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                    {item.intentId && (
                      <div className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-primary">
                        <span>{item.intentId.slice(0, 16)}...</span>
                        <ArrowRight className="size-2.5" />
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/70 p-2.5 bg-muted/10 text-center">
            <Link
              href="/app/activity"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:text-primary/90 transition"
            >
              <span>View Full Activity Log</span>
              <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
