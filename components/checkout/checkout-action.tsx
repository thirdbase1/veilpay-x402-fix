'use client'

import { useEffect, useState } from 'react'
import type { PaymentIntent } from '@/lib/payments/types'
import {
  type CheckoutFlowState,
  submitCheckoutPayment,
} from '@/lib/payments/payment-checkout'
import { payIntentWithWallet } from '@/lib/wallet/pay'
import {
  Lock,
  Loader2,
  AlertTriangle,
  Info,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  KeyRound,
  Wallet,
} from 'lucide-react'

interface CheckoutActionProps {
  intent: PaymentIntent
  onPaymentSuccess: (updatedIntent: PaymentIntent) => void
}

/**
 * Read the one-time payment secret from the checkout link fragment (#ps=...).
 * Fragments are never sent to the server, so the secret stays out of logs.
 */
function readSecretFromLink(): string | null {
  if (typeof window === 'undefined') return null
  const hash = window.location.hash
  if (!hash.startsWith('#ps=')) return null
  const secret = decodeURIComponent(hash.slice(4)).trim()
  return /^[0-9a-fA-F]{64}$/.test(secret) ? secret : null
}

export function CheckoutAction({
  intent,
  onPaymentSuccess,
}: CheckoutActionProps) {
  const [flowState, setFlowState] = useState<CheckoutFlowState>('IDLE')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [pendingCapabilities, setPendingCapabilities] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [paymentSecret, setPaymentSecret] = useState<string | null>(null)

  useEffect(() => {
    setPaymentSecret(readSecretFromLink())
  }, [])

  const handlePay = async () => {
    if (!paymentSecret) {
      setErrorMessage(
        'This checkout link is missing its payment secret. Ask the merchant for a complete payment link.',
      )
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

      // Step 2: Connect the wallet extension (user approves the session)…
      setFlowState('CONNECTING_WALLET')

      // Step 3: …then request the transfer. The wallet pops its native
      // approval dialog showing the exact token amount and merchant recipient
      // (dApp-connector makeTransfer → submitTransaction).
      const { txReference } = await payIntentWithWallet({
        recipient: intent.conditions.recipient,
        amount: intent.conditions.amount.amount,
        asset: intent.conditions.amount.asset,
        onAwaitingApproval: () => setFlowState('AWAITING_WALLET_APPROVAL'),
      })

      // Step 4: Broadcast done — submit the tx reference + payment secret to
      // the VeilPay gateway for on-chain condition verification.
      setFlowState('SUBMITTING_PAYMENT')
      const response = await submitCheckoutPayment(intent.id, {
        paymentSecret,
        network: intent.network,
        txReference,
      })

      if (response.success && response.status === 'verified' && response.intent) {
        setFlowState('VERIFIED')
        onPaymentSuccess(response.intent)
      } else if (response.code === 'VEILPAY_NOT_CONFIGURED') {
        setFlowState('INTEGRATION_PENDING')
        setErrorMessage(response.message || 'VeilPay protocol integration is not ready.')
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
      const msg = err instanceof Error ? err.message : 'Network error during payment submission'
      // User denying the approval dialog in the extension is a distinct,
      // recoverable state — not a protocol failure.
      if (/reject|denied|refus|cancel/i.test(msg)) {
        setFlowState('WALLET_REJECTED')
        setErrorMessage('Payment was rejected in your wallet. You can try again.')
      } else {
        setFlowState('PAYMENT_FAILED')
        setErrorMessage(msg)
      }
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

  const missingSecret = !paymentSecret

  return (
    <div className="space-y-4">
      {/* Live State Tracker (when interacting) */}
      {flowState !== 'IDLE' &&
        flowState !== 'INTEGRATION_PENDING' &&
        flowState !== 'WALLET_REJECTED' &&
        flowState !== 'PAYMENT_FAILED' && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2"
        >
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
            <span className="font-mono text-xs font-semibold text-foreground">
              {flowState === 'PREPARING_PAYMENT' && 'Preparing private payment conditions...'}
              {flowState === 'CONNECTING_WALLET' && 'Connecting your Midnight wallet...'}
              {flowState === 'AWAITING_WALLET_APPROVAL' && 'Approve the payment in your wallet...'}
              {flowState === 'SUBMITTING_PAYMENT' && 'Submitting payment to the VeilPay contract...'}
              {flowState === 'GENERATING_PROOF' && 'Generating zero-knowledge verification proof...'}
              {flowState === 'VERIFYING_PAYMENT' && 'Verifying payment against contract conditions...'}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Authoritative state is verified cryptographically. Transaction inputs are never exposed.
          </p>
        </div>
      )}

      {/* Missing secret notice */}
      {missingSecret && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 text-xs text-amber-200"
        >
          <KeyRound className="size-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <p className="leading-relaxed">
            This link does not contain the payment secret required to satisfy the intent.
            Request a complete payment link from the merchant.
          </p>
        </div>
      )}

      {/* Main Pay Action Button */}
      <button
        type="button"
        onClick={handlePay}
        disabled={missingSecret || isSubmitting}
        className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/20 transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            <span>Processing Private Payment...</span>
          </>
        ) : (
          <>
            <Wallet className="size-4" aria-hidden="true" />
            <span>
              Pay {intent.conditions.amount.amount} {intent.conditions.amount.asset} with Wallet
            </span>
          </>
        )}
      </button>

      {!missingSecret && (
        <p className="text-center font-mono text-[11px] text-muted-foreground">
          Your payment secret is proven to the contract — never revealed.
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
                VeilPay Protocol Not Configured
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
                    <span aria-hidden className="mt-1 size-1 shrink-0 rounded-full bg-primary" />
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>VeilPay never fakes proof execution.</span>
            <a
              href="/explorer"
              className="inline-flex items-center gap-1 text-primary hover:underline font-mono"
            >
              <span>Public Explorer</span>
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

          {!missingSecret && (
            <button
              type="button"
              onClick={handlePay}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-rose-300 hover:text-white underline pt-1"
            >
              <RefreshCw className="size-3" aria-hidden="true" />
              <span>Try Again</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
