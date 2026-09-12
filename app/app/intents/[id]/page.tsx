'use client'

import { useEffect, useState, useCallback, use, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardHeader } from '@/components/dashboard/header'
import { PaymentIntentHeader } from '@/components/payment/payment-intent-header'
import { PaymentRequirements } from '@/components/payment/payment-requirements'
import { VerificationCard } from '@/components/payment/verification-card'
import { PaymentLinkCard } from '@/components/payment/payment-link-card'
import { IntentNotFound } from '@/components/payment/intent-not-found'
import { fetchPaymentIntent, cancelPaymentIntentApi } from '@/lib/payments/service'
import type { PaymentIntent } from '@/lib/payments/types'
import { Loader2 } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function PaymentIntentDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()

  const [intent, setIntent] = useState<PaymentIntent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const isMountedRef = useRef(true)
  const isFetchingRef = useRef(false)

  // Load or refresh intent data from the real API boundary
  const loadIntent = useCallback(
    async (isManualRefresh = false) => {
      if (isFetchingRef.current) return
      isFetchingRef.current = true

      if (isManualRefresh) {
        setIsRefreshing(true)
      }

      try {
        const data = await fetchPaymentIntent(id)
        if (isMountedRef.current) {
          setIntent(data)
          setError(null)
        }
      } catch (err: unknown) {
        if (isMountedRef.current) {
          const msg =
            err instanceof Error ? err.message : 'Unable to load payment intent'
          setError(msg)
        }
      } finally {
        isFetchingRef.current = false
        if (isMountedRef.current) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
      }
    },
    [id],
  )

  // Initial fetch and controlled polling
  useEffect(() => {
    isMountedRef.current = true
    loadIntent()

    // Poll interval: active states only, stop at terminal states
    const interval = setInterval(() => {
      if (
        intent &&
        ['awaiting_payment', 'verifying', 'draft'].includes(intent.status)
      ) {
        loadIntent(false)
      }
    }, 4500)

    return () => {
      isMountedRef.current = false
      clearInterval(interval)
    }
  }, [loadIntent, intent?.status])

  // Real cancel handler
  const handleCancel = async () => {
    if (!intent) return
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

  // Loading skeleton state
  if (isLoading) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Payment Intent" />
        <main className="flex-1 p-6 sm:p-8 max-w-6xl w-full mx-auto space-y-6">
          <div className="h-4 w-48 rounded bg-muted/40 animate-pulse" />
          <div className="flex items-center justify-between border-b border-border/60 pb-5">
            <div className="space-y-2">
              <div className="h-7 w-56 rounded bg-muted/60 animate-pulse" />
              <div className="h-4 w-72 rounded bg-muted/30 animate-pulse" />
            </div>
            <div className="h-8 w-24 rounded bg-muted/40 animate-pulse" />
          </div>

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 space-y-6">
              <div className="h-64 rounded-2xl border border-border/40 bg-card/20 animate-pulse" />
              <div className="h-48 rounded-2xl border border-border/40 bg-card/20 animate-pulse" />
            </div>
            <div className="lg:col-span-5">
              <div className="h-96 rounded-2xl border border-border/40 bg-card/20 animate-pulse" />
            </div>
          </div>
        </main>
      </DashboardLayout>
    )
  }

  // Not found or error state
  if (error || !intent) {
    return (
      <DashboardLayout>
        <DashboardHeader title="Payment Intent" />
        <main className="flex-1 p-4 sm:p-8">
          <IntentNotFound id={id} error={error} />
        </main>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <DashboardHeader
        title="Intent Control Center"
        description="Verify cryptographic condition requirements and monitor zero-knowledge proof settlement."
        action={{ href: '/app/create', label: 'Create Payment Intent' }}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 max-w-6xl w-full mx-auto">
        {/* Header with Breadcrumb, Status, Copy ID, Refresh, and Cancel */}
        <PaymentIntentHeader
          intent={intent}
          onRefresh={() => loadIntent(true)}
          isRefreshing={isRefreshing}
          onCancel={handleCancel}
          isCancelling={isCancelling}
        />

        {cancelError && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3 text-xs text-rose-300"
          >
            {cancelError}
          </div>
        )}

        {/* Primary Two-Column Layout */}
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          {/* LEFT: Requirements & Verification */}
          <div className="lg:col-span-7 space-y-6">
            <PaymentRequirements intent={intent} />
            <VerificationCard intent={intent} />
          </div>

          {/* RIGHT: Customer Payment & QR Share */}
          <div className="lg:col-span-5 space-y-6 sticky top-6">
            <PaymentLinkCard
              intentId={intent.id}
              status={intent.status}
              reference={intent.conditions.reference}
              paymentSecret={intent.paymentSecret}
            />
          </div>
        </div>
      </main>
    </DashboardLayout>
  )
}
