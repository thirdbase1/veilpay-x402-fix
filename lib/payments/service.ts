import type {
  PaymentIntent,
  PaymentConditions,
  DashboardMetrics,
  PaymentIntentStatus,
} from './types'

/**
 * Client-facing typed service layer for VeilPay payment intents.
 * Communicates with the application API routes, which in turn interface
 * with the server store and the Midnight integration boundary.
 */

export async function fetchPaymentIntents(): Promise<PaymentIntent[]> {
  const res = await fetch('/api/intents', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Failed to load payment intents: ${res.statusText}`)
  }
  const data = await res.json()
  return data.intents as PaymentIntent[]
}

export async function fetchPaymentIntent(id: string): Promise<PaymentIntent> {
  const res = await fetch(`/api/intents/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Payment intent not found')
    }
    throw new Error(`Failed to load payment intent: ${res.statusText}`)
  }
  const data = await res.json()
  return data.intent as PaymentIntent
}

export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const res = await fetch('/api/intents/metrics', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Failed to load metrics: ${res.statusText}`)
  }
  return res.json()
}

export async function createPaymentIntentApi(
  conditions: PaymentConditions,
): Promise<{ intent: PaymentIntent; midnightStatus: 'published' | 'integration_pending' }> {
  const res = await fetch('/api/intents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conditions }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || 'Failed to create payment intent')
  }

  return res.json()
}

export async function cancelPaymentIntentApi(id: string): Promise<PaymentIntent> {
  const res = await fetch(`/api/intents/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(err.message || 'Failed to cancel payment intent')
  }

  const data = await res.json()
  return data.intent as PaymentIntent
}

export async function getPaymentStatusApi(id: string): Promise<PaymentIntentStatus> {
  const intent = await fetchPaymentIntent(id)
  return intent.status
}
