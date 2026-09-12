import type { PaymentIntent, PaymentIntentStatus } from './types'

/**
 * Strict checkout lifecycle states according to VeilPay protocol specification.
 */
export type CheckoutFlowState =
  | 'IDLE'
  | 'CONNECTING_WALLET'
  | 'WALLET_CONNECTED'
  | 'PREPARING_PAYMENT'
  | 'AWAITING_WALLET_APPROVAL'
  | 'SUBMITTING_PAYMENT'
  | 'PAYMENT_SUBMITTED'
  | 'GENERATING_PROOF'
  | 'VERIFYING_PAYMENT'
  | 'VERIFIED'
  | 'WALLET_REJECTED'
  | 'PAYMENT_FAILED'
  | 'PROOF_FAILED'
  | 'VERIFICATION_FAILED'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'INTEGRATION_PENDING'

export interface PaySubmitResponse {
  success: boolean
  status: PaymentIntentStatus
  intent?: PaymentIntent
  code?: string
  message?: string
  error?: string
  missingCapabilities?: string[]
}

/**
 * Client service to load the authoritative checkout intent.
 */
export async function getCheckoutIntent(id: string): Promise<PaymentIntent> {
  const res = await fetch(`/api/intents/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Payment intent not found in protocol registry')
    }
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `Failed to fetch payment intent: ${res.statusText}`)
  }

  const data = await res.json()
  return data.intent as PaymentIntent
}

/**
 * Client service to submit a customer payment against an active payment intent.
 * The payment secret (from the checkout link fragment) is proven to the VeilPay
 * contract; no wallet address or other payer identity is required.
 */
export async function submitCheckoutPayment(
  intentId: string,
  payload: {
    paymentSecret: string
    network?: string
    /** Reference of the wallet-broadcast transfer (dApp-connector submitTransaction). */
    txReference?: string
  },
): Promise<PaySubmitResponse> {
  const res = await fetch(`/api/intents/${encodeURIComponent(intentId)}/pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const data = await res.json().catch(() => ({
    success: false,
    status: 'failed' as PaymentIntentStatus,
    message: 'Invalid response from payment protocol endpoint',
  }))

  return data as PaySubmitResponse
}
