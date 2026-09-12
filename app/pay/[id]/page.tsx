'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import type { PaymentIntent } from '@/lib/payments/types'
import { getCheckoutIntent } from '@/lib/payments/payment-checkout'
import { CheckoutHeader } from '@/components/checkout/checkout-header'
import { CheckoutCard } from '@/components/checkout/checkout-card'
import { CheckoutPrivacy } from '@/components/checkout/checkout-privacy'
import { CheckoutAction } from '@/components/checkout/checkout-action'
import {
  CheckoutNotFound,
  CheckoutExpired,
  CheckoutCancelled,
  CheckoutVerifiedReceipt,
} from '@/components/checkout/checkout-terminal'
import { Loader2 } from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function CustomerPayPage({ params }: PageProps) {
  const { id } = use(params)

  const [intent, setIntent] = useState<PaymentIntent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Polling ref to control interval cleanup on terminal states
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const loadIntent = useCallback(async () => {
    try {
      const data = await getCheckoutIntent(id)
      setIntent(data)
      setError(null)
      return data
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unable to resolve payment intent'
      setError(message)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [id])

  // Initial load
  useEffect(() => {
    loadIntent()
  }, [loadIntent])

  // Controlled polling when intent is active (awaiting_payment or verifying)
  useEffect(() => {
    if (!intent) return

    const isTerminal =
      intent.status === 'verified' ||
      intent.status === 'expired' ||
      intent.status === 'cancelled' ||
      intent.status === 'failed'

    if (isTerminal) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    // Poll every 4 seconds to sync status with merchant or on-chain events
    pollingRef.current = setInterval(async () => {
      const updated = await loadIntent()
      if (
        updated &&
        (updated.status === 'verified' ||
          updated.status === 'expired' ||
          updated.status === 'cancelled' ||
          updated.status === 'failed')
      ) {
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }
      }
    }, 4000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [intent?.status, loadIntent, intent])

  const handlePaymentSuccess = (updatedIntent: PaymentIntent) => {
    setIntent(updatedIntent)
  }

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <CheckoutHeader />
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <Loader2 className="size-8 animate-spin text-primary" aria-hidden="true" />
            <p className="font-mono text-xs text-muted-foreground">
              Resolving payment intent from VeilPay protocol...
            </p>
          </div>
        </main>
      </div>
    )
  }

  // 2. Not Found or Error State
  if (error || !intent) {
    return (
      <div className="flex min-h-screen flex-col bg-background text-foreground">
        <CheckoutHeader />
        <main className="flex-1 px-4 py-10">
          <CheckoutNotFound intentId={id} />
        </main>
      </div>
    )
  }

  // 3. Terminal States
  const isExpired = intent.status === 'expired'
  const isCancelled = intent.status === 'cancelled'
  const isVerified = intent.status === 'verified'

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      <CheckoutHeader network={intent.network} />

      <main className="flex-1 px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-xl space-y-6">
          {/* Main Content Area based on Intent Status */}
          {isVerified ? (
            <CheckoutVerifiedReceipt intent={intent} />
          ) : isExpired ? (
            <CheckoutExpired intent={intent} />
          ) : isCancelled ? (
            <CheckoutCancelled intent={intent} />
          ) : (
            <>
              {/* Payment Request Card with Amount Centerpiece */}
              <CheckoutCard intent={intent} />

              {/* Payment Action & State Machine */}
              <CheckoutAction intent={intent} onPaymentSuccess={handlePaymentSuccess} />
            </>
          )}

          {/* Privacy Preservation Model Card */}
          <CheckoutPrivacy />
        </div>
      </main>
    </div>
  )
}
