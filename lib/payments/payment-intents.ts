import {
  fetchPaymentIntent,
  getPaymentStatusApi,
  listPaymentIntents as listPaymentIntentsApi,
  cancelPaymentIntentApi,
} from './service'
import type { PaymentIntent, PaymentIntentStatus } from './types'
import type { ListPaymentIntentsParams, ListPaymentIntentsResponse } from './service'

/**
 * Service boundary for payment intent queries and lifecycle mutations.
 *
 * Implements clean getters for merchant detail views, list views, and external callers.
 */

export async function listPaymentIntents(
  params?: ListPaymentIntentsParams,
): Promise<ListPaymentIntentsResponse> {
  return listPaymentIntentsApi(params)
}

export async function getPaymentIntent(id: string): Promise<PaymentIntent> {
  return fetchPaymentIntent(id)
}

export async function getPaymentStatus(id: string): Promise<PaymentIntentStatus> {
  return getPaymentStatusApi(id)
}

export async function cancelPaymentIntent(id: string): Promise<PaymentIntent> {
  return cancelPaymentIntentApi(id)
}

/**
 * Build the customer checkout link. When a payment secret is supplied it is
 * carried in the URL fragment (`#ps=`), which browsers never send to servers —
 * keeping the secret out of access logs while still reaching the payer.
 */
export function getPaymentLink(id: string, origin?: string, paymentSecret?: string): string {
  const path = `/pay/${encodeURIComponent(id)}`
  const fragment = paymentSecret ? `#ps=${encodeURIComponent(paymentSecret)}` : ''
  if (origin) {
    return `${origin.replace(/\/$/, '')}${path}${fragment}`
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}${fragment}`
  }
  return path
}
