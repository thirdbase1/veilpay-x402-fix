'use client'

import useSWR from 'swr'
import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Radio,
  ShieldCheck,
  XCircle,
  Hourglass,
  Ban,
} from 'lucide-react'
import { Wordmark } from '@/components/site/brand'

interface ExplorerPayment {
  id: string
  status: string
  amountKind: string
  asset: string
  amount: string
  amountMax: string | null
  network: string
  recipientMasked: string | null
  reference: string | null
  merchantName: string
  createdAt: string
  updatedAt: string
  expiresAt: string | null
}

interface ExplorerResponse {
  payments: ExplorerPayment[]
  stats: {
    total: number
    verified: number
    awaiting: number
    expired: number
    settledVolume: number
  }
  generatedAt: string
}

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then((r) => r.json())

const STATUS_META: Record<
  string,
  { label: string; icon: typeof CheckCircle2; badge: string }
> = {
  verified: {
    label: 'Verified',
    icon: CheckCircle2,
    badge: 'border-accent/30 bg-accent/10 text-accent',
  },
  awaiting_payment: {
    label: 'Awaiting Payment',
    icon: Hourglass,
    badge: 'border-warning/30 bg-warning/10 text-warning',
  },
  verifying: {
    label: 'Verifying',
    icon: Activity,
    badge: 'border-primary/30 bg-primary/10 text-primary',
  },
  expired: {
    label: 'Expired',
    icon: Clock,
    badge: 'border-border/30 bg-muted/10 text-muted-foreground',
  },
  failed: {
    label: 'Failed',
    icon: XCircle,
    badge: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  cancelled: {
    label: 'Cancelled',
    icon: Ban,
    badge: 'border-border/30 bg-muted/10 text-muted-foreground',
  },
}

function formatAmount(p: ExplorerPayment): string {
  if (p.amountKind === 'range' && p.amountMax) {
    return `${p.amount}–${p.amountMax} ${p.asset}`
  }
  const prefix = p.amountKind === 'at_least' ? '≥ ' : ''
  return `${prefix}${p.amount} ${p.asset}`
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function ExplorerPage() {
  // Live feed: SWR revalidates every 3s and on window focus, so new payments
  // and status transitions appear without any manual refresh.
  const { data, error, isLoading } = useSWR<ExplorerResponse>('/api/explorer', fetcher, {
    refreshInterval: 3000,
    keepPreviousData: true,
  })

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="size-4" />
              <span className="sr-only sm:not-sr-only">Home</span>
            </Link>
            <span aria-hidden className="h-5 w-px bg-border" />
            <Link href="/" aria-label="VeilPay home">
              <Wordmark />
            </Link>
          </div>

          <div
            className="flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 font-mono text-[11px] text-primary"
            role="status"
            aria-live="polite"
          >
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            <span>Live</span>
            <span aria-hidden className="size-1 rounded-full bg-primary/50" />
            <span className="hidden sm:inline">3s refresh</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:px-8">
        {/* Heading */}
        <div className="max-w-2xl">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
            Public Ledger
          </p>
          <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            VeilPay Payment Explorer
          </h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
            Every payment intent registered on the VeilPay protocol, updating in
            real time. Payers stay anonymous — only settlement status, amount,
            and masked recipients are public. No balances, addresses, or
            payment history are ever exposed.
          </p>
        </div>

        {/* Stats */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Intents Tracked', value: data?.stats.total ?? '—' },
            { label: 'Verified', value: data?.stats.verified ?? '—' },
            { label: 'Awaiting Payment', value: data?.stats.awaiting ?? '—' },
            {
              label: 'Settled Volume',
              value: data ? `${data.stats.settledVolume.toLocaleString()}` : '—',
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border/70 bg-card/40 p-4 backdrop-blur-sm"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {stat.label}
              </p>
              <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums text-foreground">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Feed */}
        <section className="mt-8" aria-label="Payment feed">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Radio className="size-4 text-primary" />
              Recent Payments
            </h2>
            {data?.generatedAt && (
              <span className="font-mono text-[11px] text-muted-foreground">
                synced {relativeTime(data.generatedAt)}
              </span>
            )}
          </div>

          {isLoading && !data ? (
            <div className="space-y-2 pt-4" aria-busy="true">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 animate-pulse rounded-xl border border-border/50 bg-muted/20"
                />
              ))}
            </div>
          ) : error ? (
            <div
              role="alert"
              className="mt-4 rounded-xl border border-destructive/30 bg-destructive/20 p-4 text-xs text-destructive"
            >
              Unable to reach the explorer feed. Retrying automatically…
            </div>
          ) : !data || data.payments.length === 0 ? (
            <div className="mt-4 rounded-xl border border-border/60 bg-card/30 p-10 text-center">
              <ShieldCheck className="mx-auto size-8 text-muted-foreground/50" />
              <p className="mt-3 text-sm font-medium">No payments yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Registered payment intents will appear here the moment they are
                created.
              </p>
              <Link
                href="/app/create"
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
              >
                Create the first payment intent
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {data.payments.map((p) => {
                const meta = STATUS_META[p.status] ?? {
                  label: p.status,
                  icon: Activity,
                  badge: 'border-border bg-muted/40 text-muted-foreground',
                }
                const Icon = meta.icon
                return (
                  <li
                    key={p.id}
                    className="flex flex-col gap-2 py-3.5 transition-colors hover:bg-muted/10 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-medium ${meta.badge}`}
                      >
                        <Icon className="size-3" />
                        {meta.label}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {p.merchantName}
                          {p.reference ? (
                            <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                              {p.reference}
                            </span>
                          ) : null}
                        </p>
                        <p className="truncate font-mono text-[11px] text-muted-foreground">
                          {p.id}
                          {p.recipientMasked ? ` → ${p.recipientMasked}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pl-1 sm:justify-end sm:pl-0">
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {formatAmount(p)}
                      </span>
                      <span className="w-16 text-right font-mono text-[11px] text-muted-foreground">
                        {relativeTime(p.updatedAt)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <p className="mt-10 border-t border-border/50 pt-6 text-center font-mono text-[11px] text-muted-foreground">
          Zero-knowledge settlement on Midnight · payer identities are never
          published
        </p>
      </main>
    </div>
  )
}
