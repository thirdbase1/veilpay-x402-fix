'use client'

import { useState } from 'react'
import type { PaymentIntent } from '@/lib/payments/types'
import {
  type CheckoutFlowState,
  submitCheckoutPayment,
} from '@/lib/payments/payment-checkout'
import {
  Lock,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'

interface CheckoutActionProps {
  intent: PaymentIntent
  connectedAddress: string | null
  onPaymentSuccess: (updatedIntent: PaymentIntent) => void
}

export function CheckoutAction({
  intent,
  connectedAddress,
  onPaymentSuccess,
}: CheckoutActionProps) {
  const [flowState, setFlowState] = useState<CheckoutFlowState>('IDLE')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pendingCapabilities, setPendingCapabilities] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handlePay = async () => {
    if (!connectedAddress) {
      setErrorMessage('Please connect your Midnight wallet first.')
      return
    }

    // Double-payment guard
    if (isSubmitting || flowState === 'VERIFYING_PAYMENT') return

    setIsSubmitting(true)
    setErrorMessage(null)
    setPendingCapabilities([])

    try {
      // Step 1: Preparing Payment
      setFlowState('PREPARING_PAYMENT')

      // Step 2: Awaiting Wallet Approval & Submitting
      setFlowState('AWAITING_WALLET_APPROVAL')

      // Real protocol submission to authoritative server endpoint
      setFlowState('SUBMITTING_PAYMENT')
      const response = await submitCheckoutPayment(intent.id, {
        payerAddress: connectedAddress,
        network: intent.network,
      })

      if (response.success && response.status === 'verified' && response.intent) {
        setFlowState('VERIFIED')
        onPaymentSuccess(response.intent)
      } else if (response.code === 'MIDNIGHT_INTEGRATION_PENDING') {
        // Honest protocol state: Midnight contract and proof server are in pending integration
        setFlowState('INTEGRATION_PENDING')
        setErrorMessage(response.message || 'Midnight contract and proof-server integration is pending.')
        setPendingCapabilities(response.missingCapabilities || [])
      } else if (response.code === 'ALREADY_VERIFIED') {
        setFlowState('VERIFIED')
        if (response.intent) onPaymentSuccess(response.intent)
      } else if (response.code === 'INTENT_EXPIRED') {
        setFlowState('EXPIRED')
        setErrorMessage(response.error || 'This payment intent has expired.')
      } else if (response.code === 'INTENT_CANCELLED') {
        setFlowState('CANCELLED')
        setErrorMessage(response.error || 'This payment intent was cancelled by the merchant.')
      } else {
        setFlowState('PAYMENT_FAILED')
        setErrorMessage(response.message || response.error || 'Payment execution failed on protocol layer.')
      }
    } catch (err: unknown) {
      setFlowState('PAYMENT_FAILED')
      const msg = err instanceof Error ? err.message : 'Network error during payment submission'
      setErrorMessage(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // If already verified
  if (intent.status === 'verified' || flowState === 'VERIFIED') {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-6 text-center space-y-3">
        <CheckCircle2 className="mx-auto size-8 text-emerald-400" aria-hidden="true" />
        <h3 className="font-mono text-base font-semibold text-emerald-400">
          Payment Verified
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
          Your payment was verified successfully by the protocol. The merchant received the
          cryptographic confirmation required by this payment intent.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Live State Tracker (when interacting) */}
      {flowState !== 'IDLE' && flowState !== 'INTEGRATION_PENDING' && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2"
        >
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold text-foreground">
              {flowState === 'PREPARING_PAYMENT' && 'Preparing private payment conditions...'}
              {flowState === 'AWAITING_WALLET_APPROVAL' && 'Awaiting approval in Midnight wallet...'}
              {flowState === 'SUBMITTING_PAYMENT' && 'Submitting payment intent to Midnight protocol...'}
              {flowState === 'GENERATING_PROOF' && 'Generating zero-knowledge verification proof...'}
              {flowState === 'VERIFYING_PAYMENT' && 'Verifying payment against contract conditions...'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Authoritative state is verified cryptographically. Transaction inputs are never exposed.
          </p>
        </div>
      )}

      {/* Main Pay Action Button */}
      <button
        type="button"
        onClick={handlePay}
        disabled={!connectedAddress || isSubmitting}
        className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>Processing Private Payment...</span>
          </>
        ) : (
          <>
            <Lock className="size-4" aria-hidden="true" />
            <span>Pay with Midnight ZK Proof</span>
          </>
        )}
      </button>

      {!connectedAddress && (
        <p className="text-center font-mono text-[11px] text-muted-foreground">
          Connect your Midnight wallet above to unlock payment.
        </p>
      )}

      {/* Honest Protocol State: Integration Pending */}
      {flowState === 'INTEGRATION_PENDING' && (
        <div
          role="region"
          aria-label="Protocol Status"
          className="rounded-2xl border border-primary/30 bg-primary/5 p-5 space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <Info className="size-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h4 className="font-mono text-xs font-semibold text-foreground">
                Midnight Protocol Integration Pending
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {errorMessage}
              </p>
            </div>
          </div>

          {pendingCapabilities.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-background/80 p-3 space-y-1.5 text-xs">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Deployment Requirements:
              </p>
              <ul className="space-y-1 text-[11px] text-muted-foreground font-mono">
                {pendingCapabilities.map((cap) => (
                  <li key={cap} className="flex items-start gap-1.5">
                    <span className="text-primary">•</span>
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>VeilPay never fakes proof execution.</span>
            <a
              href="/docs"
              className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
            >
              <span>Protocol Specs</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </div>
        </div>
      )}

      {/* Error State */}
      {errorMessage && flowState !== 'INTEGRATION_PENDING' && (
        <div
          role="alert"
          className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-2 text-xs text-rose-300"
        >
          <div className="flex items-center gap-2 font-medium text-rose-400">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>Payment Submission Notice</span>
          </div>
          <p className="text-[11px] text-rose-300/90 leading-relaxed">{errorMessage}</p>

          <button
            type="button"
            onClick={handlePay}
            className="inline-flex items-center gap-1.5 font-mono text-[11px] text-rose-300 hover:text-white underline pt-1"
          >
            <RefreshCw className="size-3" aria-hidden="true" />
            <span>Try Again</span>
          </button>
        </div>
      )}
    </div>
  )
}
