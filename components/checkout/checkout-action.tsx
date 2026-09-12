'use client'

import { useEffect, useState } from 'react'
import type { PaymentIntent } from '@/lib/payments/types'
import {
  type CheckoutFlowState,
  submitCheckoutPayment,
} from '@/lib/payments/payment-checkout'
import { detectInjectedWallets } from '@/lib/wallet/detect'
import type { PayerCoin } from '@/lib/veilpay/client'
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
  Coins,
} from 'lucide-react'

/** The on-chain invoice id this checkout settles (registered at create time). */
function chainIntentIdOf(intent: PaymentIntent): string {
  const id = (intent as { chainIntentId?: string }).chainIntentId
  if (!id) throw new Error('This invoice has no on-chain registration to settle against.')
  return id
}

/**
 * Pick the shielded coin the pay circuit will spend. Coin discovery inside
 * the extension API has not shipped (docs/MIGRATION-V2-INVOICE.md "Payer
 * funding caveat"), so this returns null until payer funding lands.
 */
async function selectPayerCoin(_intent: PaymentIntent): Promise<PayerCoin | null> {
  return null
}

interface CheckoutActionProps {
  intent: PaymentIntent
  onPaymentSuccess: (updatedIntent: PaymentIntent) => void
}

/**
 * Read the claim code from the checkout link. Per the v2 invoice vocabulary
 * the canonical form is `pay/<id>?secret=<hex>`; the `#ps=` fragment variant
 * is also accepted (fragments are never sent to the server, so the secret
 * stays out of logs entirely).
 */
function readSecretFromLink(): string | null {
  if (typeof window === 'undefined') return null
  const fromQuery = new URLSearchParams(window.location.search).get('secret')
  const candidate = (fromQuery ?? window.location.hash.replace(/^#ps=/, '')).trim()
  const secret = decodeURIComponent(candidate)
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

      // Step 2: v2 settlement spends a real shielded coin from the payer's
      // synced wallet (docs/MIGRATION-V2-INVOICE.md "Payer funding caveat").
      // The extension API does not expose coin discovery yet, so until payer
      // funding lands there is no coin to spend — surface the honest funding
      // state instead of faking a settlement or leaking an unshielded transfer.
      const coin = await selectPayerCoin(intent)
      if (!coin) {
        setFlowState('FUNDING_REQUIRED')
        setErrorMessage(
          'Shielded settlement needs one funded, synced coin of the matching token color in your wallet. Payer coin discovery has not shipped yet — this invoice cannot be settled from the browser until then.',
        )
        return
      }

      // Step 3: Connect the wallet extension (user approves the session), then
      // prove + submit the pay circuit call. The wallet pops its native
      // approval dialog for the shielded spend (change returns to the payer).
      setFlowState('CONNECTING_WALLET')
      const { payInvoice } = await import('@/lib/veilpay/client')
      const wallets = detectInjectedWallets()
      if (wallets.length === 0) {
        throw new Error(
          'No Midnight wallet extension detected. Install Lace or the 1AM wallet, then reload this page.',
        )
      }
      const txReference = await payInvoice(wallets[0].id, {
        chainIntentId: chainIntentIdOf(intent),
        paymentSecret,
        coin,
      }).then(() => `shielded_pay_${intent.id}`)

      // Step 4: Broadcast done — the server verifies the invoice settled on
      // the public ledger (receipt commitment present, status PAID).
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
      <div className="rounded-2xl border border-accent/30 bg-accent/20 p-6 text-center space-y-3">
        <CheckCircle2 className="mx-auto size-8 text-accent" aria-hidden="true" />
        <h3 className="font-mono text-base font-semibold text-accent">
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
              {flowState === 'SUBMITTING_PAYMENT' && 'Verifying settlement on the public ledger...'}
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
          className="flex items-start gap-2.5 rounded-xl border border-warning/30 bg-warning/20 p-4 text-xs text-warning"
        >
          <KeyRound className="size-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
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

      {/* Honest Protocol State: Payer Funding Required */}
      {flowState === 'FUNDING_REQUIRED' && (
        <div
          role="region"
          aria-label="Payer Funding Status"
          className="rounded-2xl border border-warning/30 bg-warning/10 p-5 space-y-3"
        >
          <div className="flex items-start gap-2.5">
            <Coins className="size-4 text-warning shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1">
              <h4 className="font-mono text-xs font-semibold text-foreground">
                Payer Coin Funding Required
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {errorMessage}
              </p>
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                v2 invoices settle with a shielded coin spend — the app never moves unshielded
                tDUST as a substitute, and never sponsors anyone&apos;s fees.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {errorMessage && flowState !== 'INTEGRATION_PENDING' && flowState !== 'FUNDING_REQUIRED' && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/20 p-4 space-y-2 text-xs text-destructive"
        >
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            <span>Payment Submission Notice</span>
          </div>
          <p className="text-[11px] text-destructive/90 leading-relaxed">{errorMessage}</p>

          {!missingSecret && (
            <button
              type="button"
              onClick={handlePay}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] text-destructive hover:text-white underline pt-1"
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
