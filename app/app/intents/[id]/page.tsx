'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardHeader } from '@/components/dashboard/header'
import { PaymentIntentStatusBadge } from '@/components/dashboard/payment-intent-status'
import { PaymentLinkPanel } from '@/components/payment/payment-link'
import { VerificationStatusFlow } from '@/components/payment/verification-status'
import { fetchPaymentIntent, cancelPaymentIntentApi } from '@/lib/payments/service'
import { describeAmountCondition } from '@/lib/payments/intent'
import type { PaymentIntent } from '@/lib/payments/types'
import {
  ArrowLeft,
  Calendar,
  Clock,
  ShieldCheck,
  Wallet,
  Ban,
  Loader2,
  AlertTriangle,
  ReceiptText,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function PaymentIntentDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [intent, setIntent] = useState<PaymentIntent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const loadIntent = useCallback(async () => {
    try {
      const data = await fetchPaymentIntent(id)
      setIntent(data)
      setError(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to load intent'
      setError(msg)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadIntent()

    // Poll every 5s while intent is in active non-terminal state
    const interval = setInterval(() => {
      if (intent && ['awaiting_payment', 'verifying'].includes(intent.status)) {
        loadIntent()
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [loadIntent, intent?.status])

  const handleCancel = async () => {
    if (!intent) return
    const confirmed = window.confirm(
      'Are you sure you want to cancel this payment intent? Customers will no longer be able to complete payment.',
    )
    if (!confirmed) return

    setIsCancelling(true)
    setCancelError(null)

    try {
      const updated = await cancelPaymentIntentApi(intent.id)
      setIntent(updated)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel intent'
      setCancelError(msg)
    } finally {
      setIsCancelling(false)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Payment Intent" />
        <main className="flex-1 p-8 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-6 animate-spin text-primary" />
            <p>Loading payment intent details from protocol state...</p>
          </div>
        </main>
      </DashboardLayout>
    )
  }

  if (error || !intent) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Payment Intent" />
        <main className="flex-1 p-8 space-y-4 max-w-2xl">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to overview
          </Link>

          <div
            role="alert"
            className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-6 text-rose-300 space-y-3"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-300">
              <AlertTriangle className="size-4" />
              Payment Intent Not Found
            </div>
            <p className="text-xs text-rose-400/90 leading-relaxed">
              {error || `No registered payment intent with identifier "${id}" exists in the protocol.`}
            </p>
            <button
              type="button"
              onClick={() => router.push('/app')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
            >
              Return to overview
            </button>
          </div>
        </main>
      </DashboardLayout>
    )
  }

  const canCancel = ['draft', 'awaiting_payment'].includes(intent.status)
  const formattedCreated = new Date(intent.createdAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  const formattedExpiry = intent.conditions.expiresAt
    ? new Date(intent.conditions.expiresAt).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'None (Does not expire)'

  return (
    <DashboardLayout>
      <DashboardHeader
        title={`Intent: ${intent.id}`}
        description="Verify condition requirements and track settlement proof."
        action={{ href: '/app/create', label: 'Create new intent' }}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 max-w-5xl">
        {/* Navigation & Status Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to all intents
          </Link>

          <div className="flex items-center gap-2.5">
            <PaymentIntentStatusBadge status={intent.status} />

            {canCancel && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={isCancelling}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 px-2.5 py-1 text-xs font-medium text-rose-400 hover:bg-rose-950/20 disabled:opacity-50"
              >
                {isCancelling ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Ban className="size-3.5" />
                )}
                Cancel intent
              </button>
            )}
          </div>
        </div>

        {cancelError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300"
          >
            {cancelError}
          </div>
        )}

        {/* Share & Checkout Panel */}
        <PaymentLinkPanel intentId={intent.id} />

        {/* Verification Status Stepper */}
        <VerificationStatusFlow status={intent.status} />

        {/* Main Details Grid */}
        <div className="rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Payment Intent Specification
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cryptographic condition requirements defined by the merchant.
              </p>
            </div>
            <ReceiptText className="size-4 text-muted-foreground" />
          </div>

          <div className="grid gap-5 sm:grid-cols-2 text-xs">
            {/* Requirement */}
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Required Condition
              </span>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {describeAmountCondition(intent.conditions)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Asset: {intent.conditions.amount.asset} • Predicate: {intent.conditions.amount.kind}
              </p>
            </div>

            {/* Recipient */}
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Merchant Destination
              </span>
              <p className="mt-1 break-all font-mono text-xs text-foreground">
                {intent.conditions.recipient}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Target account to satisfy payment condition
              </p>
            </div>

            {/* Created */}
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Creation Timestamp
              </span>
              <p className="mt-1 font-mono text-xs text-foreground flex items-center gap-1.5">
                <Clock className="size-3.5 text-muted-foreground" />
                {formattedCreated}
              </p>
              {intent.conditions.reference && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Reference: <span className="font-mono text-foreground">{intent.conditions.reference}</span>
                </p>
              )}
            </div>

            {/* Expiration */}
            <div className="rounded-xl border border-border/60 bg-background/50 p-4">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Expiration Deadline
              </span>
              <p className="mt-1 font-mono text-xs text-foreground flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted-foreground" />
                {formattedExpiry}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Transactions submitted after this timestamp are rejected by protocol rules.
              </p>
            </div>
          </div>
        </div>

        {/* Privacy Model Notice */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-4 flex items-start gap-3">
          <ShieldCheck className="size-5 text-primary shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground">Privacy Preservation Principle</p>
            <p className="mt-0.5">
              VeilPay is designed to show merchants the payment information required to verify an intent
              while minimizing unnecessary disclosure. Payer wallet history, total balances, and off-intent
              activity remain shielded by Midnight&apos;s zero-knowledge architecture.
            </p>
          </div>
        </div>
      </main>
    </DashboardLayout>
  )
}
