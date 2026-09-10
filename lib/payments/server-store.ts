import type { PaymentIntent, DashboardMetrics, PaymentIntentStatus } from './types'

/**
 * Server-side volatile intent registry for the application instance.
 *
 * In production with a persistent database, this delegates to Postgres/Midnight indexer.
 * Here it holds real intents created by the user during the active session.
 * It NEVER seeds fake mock transactions or dummy data.
 * When a fresh instance starts, intents are empty ([]).
 */

declare global {
  // eslint-disable-next-line no-var
  var __veilpay_intents_store__: Map<string, PaymentIntent> | undefined
}

function getStore(): Map<string, PaymentIntent> {
  if (!globalThis.__veilpay_intents_store__) {
    globalThis.__veilpay_intents_store__ = new Map<string, PaymentIntent>()
  }
  return globalThis.__veilpay_intents_store__
}

export function saveServerIntent(intent: PaymentIntent): PaymentIntent {
  const store = getStore()
  const updated: PaymentIntent = {
    ...intent,
    updatedAt: new Date().toISOString(),
  }
  store.set(intent.id, updated)
  return updated
}

export function getServerIntent(id: string): PaymentIntent | null {
  const store = getStore()
  const intent = store.get(id)
  if (!intent) return null

  // Check auto-expiration if applicable
  if (
    intent.status === 'awaiting_payment' &&
    intent.conditions.expiresAt &&
    new Date(intent.conditions.expiresAt).getTime() < Date.now()
  ) {
    const expired: PaymentIntent = {
      ...intent,
      status: 'expired',
      updatedAt: new Date().toISOString(),
    }
    store.set(id, expired)
    return expired
  }

  return intent
}

export function listServerIntents(merchantRecipient?: string): PaymentIntent[] {
  const store = getStore()
  const all = Array.from(store.values())

  const now = Date.now()
  // Auto-expire past-due awaiting intents
  for (const intent of all) {
    if (
      intent.status === 'awaiting_payment' &&
      intent.conditions.expiresAt &&
      new Date(intent.conditions.expiresAt).getTime() < now
    ) {
      intent.status = 'expired'
      intent.updatedAt = new Date().toISOString()
      store.set(intent.id, intent)
    }
  }

  const filtered = merchantRecipient
    ? all.filter((i) => i.conditions.recipient.toLowerCase() === merchantRecipient.toLowerCase())
    : all

  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function updateServerIntentStatus(
  id: string,
  status: PaymentIntentStatus,
): PaymentIntent | null {
  const store = getStore()
  const existing = store.get(id)
  if (!existing) return null

  const updated: PaymentIntent = {
    ...existing,
    status,
    updatedAt: new Date().toISOString(),
  }
  store.set(id, updated)
  return updated
}

export function computeServerMetrics(merchantRecipient?: string): DashboardMetrics {
  const intents = listServerIntents(merchantRecipient)
  return {
    totalCount: intents.length,
    activeCount: intents.filter((i) => i.status === 'awaiting_payment').length,
    verifiedCount: intents.filter((i) => i.status === 'verified').length,
    pendingCount: intents.filter((i) => i.status === 'verifying').length,
    expiredCount: intents.filter((i) => i.status === 'expired').length,
  }
}
