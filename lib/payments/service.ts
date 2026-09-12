import type {
  PaymentIntent,
  PaymentConditions,
  DashboardMetrics,
  PaymentIntentStatus,
} from './types'

/**
 * Client-facing typed service layer for VeilPay invoices.
 * Communicates with the application API routes, which in turn interface
 * with the server store and the Midnight integration boundary.
 */

export interface ListPaymentIntentsParams {
  search?: string
  status?: 'all' | PaymentIntentStatus
  sort?: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc' | 'expires_asc' | 'status'
  page?: number
  pageSize?: number
  recipient?: string
}

export interface ListPaymentIntentsResponse {
  intents: PaymentIntent[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Fetch paginated, filtered, and sorted invoices from the authoritative API.
 */
export async function listPaymentIntents(
  params?: ListPaymentIntentsParams,
): Promise<ListPaymentIntentsResponse> {
  const query = new URLSearchParams()
  if (params?.search) query.set('search', params.search)
  if (params?.status && params.status !== 'all') query.set('status', params.status)
  if (params?.sort) query.set('sort', params.sort)
  if (params?.page) query.set('page', params.page.toString())
  if (params?.pageSize) query.set('pageSize', params.pageSize.toString())
  if (params?.recipient) query.set('recipient', params.recipient)

  const url = query.toString() ? `/api/intents?${query.toString()}` : '/api/intents'

  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error(`Failed to load invoices: ${res.statusText}`)
  }

  const data = await res.json()
  return {
    intents: data.intents as PaymentIntent[],
    total: typeof data.total === 'number' ? data.total : (data.intents?.length ?? 0),
    page: typeof data.page === 'number' ? data.page : 1,
    pageSize: typeof data.pageSize === 'number' ? data.pageSize : (data.intents?.length ?? 10),
    totalPages: typeof data.totalPages === 'number' ? data.totalPages : 1,
  }
}

/**
 * Backwards-compatible convenience getter returning plain PaymentIntent[]
 */
export async function fetchPaymentIntents(
  params?: ListPaymentIntentsParams,
): Promise<PaymentIntent[]> {
  const result = await listPaymentIntents(params)
  return result.intents
}

export async function fetchPaymentIntent(id: string): Promise<PaymentIntent> {
  const res = await fetch(`/api/intents/${encodeURIComponent(id)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error('Invoice not found')
    }
    throw new Error(`Failed to load invoice: ${res.statusText}`)
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
  walletId: string | null,
): Promise<{ intent: PaymentIntent; midnightStatus: 'published' | 'integration_pending' }> {
  if (!walletId) {
    throw new Error(
      'Connect your Midnight wallet extension first — invoices are signed from your own wallet.',
    )
  }

  // Per docs/MIGRATION-V2-INVOICE.md: the invoice is issued client-side (the
  // wallet signs createIntent), then the server verifies it against the
  // public ledger and registers its metadata.
  const { issueInvoice } = await import('@/lib/veilpay/client')
  const { parseDecimalToMicroUnits } = await import('@/lib/payments/intent')

  const amountMicro = parseDecimalToMicroUnits(conditions.amount.amount)
  if (amountMicro === null || amountMicro <= 0n) {
    throw new Error('Amount must be a positive decimal number with at most 6 decimal places.')
  }

  const issued = await issueInvoice(walletId, {
    amountMicro,
    ttlOps: 50,
  })

  const res = await fetch('/api/intents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      conditions,
      chainIntentId: issued.chainIntentId,
      paymentSecret: issued.paymentSecret,
      merchantCoinPk: issued.merchantCoinPk,
      tokenColor: issued.tokenColor,
      expiresAtOps: issued.expiresAtOps,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.message || 'Failed to register invoice')
  }

  return res.json()
}

export async function cancelPaymentIntentApi(id: string): Promise<PaymentIntent> {
  const res = await fetch(`/api/intents/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || err.message || 'Failed to cancel invoice')
  }

  const data = await res.json()
  return data.intent as PaymentIntent
}

export async function getPaymentStatusApi(id: string): Promise<PaymentIntentStatus> {
  const intent = await fetchPaymentIntent(id)
  return intent.status
}
