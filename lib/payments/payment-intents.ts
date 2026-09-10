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
