import { fetchPaymentIntent, getPaymentStatusApi } from './service'
import type { PaymentIntent, PaymentIntentStatus } from './types'

/**
 * Service boundary for payment intent queries.
 *
 * Implements clean getters for merchant detail views and external callers.
 */

export async function getPaymentIntent(id: string): Promise<PaymentIntent> {
  return fetchPaymentIntent(id)
}

export async function getPaymentStatus(id: string): Promise<PaymentIntentStatus> {
  return getPaymentStatusApi(id)
}

export function getPaymentLink(id: string, origin?: string): string {
  const path = `/pay/${encodeURIComponent(id)}`
  if (origin) {
    return `${origin.replace(/\/$/, '')}${path}`
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`
  }
  return path
}
