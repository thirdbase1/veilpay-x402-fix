import { createClient } from '@/lib/supabase/server'
import type { ActivityEventType, ActivityRecord, ActivityListResponse } from './types'

// Server memory fallback registry for local instances or session continuity
declare global {
  // eslint-disable-next-line no-var
  var __veilpay_activities_store__: ActivityRecord[] | undefined
  // eslint-disable-next-line no-var
  var __veilpay_recent_event_keys__: Map<string, number> | undefined
}

function getActivityStore(): ActivityRecord[] {
  if (!globalThis.__veilpay_activities_store__) {
    globalThis.__veilpay_activities_store__ = []
  }
  return globalThis.__veilpay_activities_store__
}

function getRecentEventMap(): Map<string, number> {
  if (!globalThis.__veilpay_recent_event_keys__) {
    globalThis.__veilpay_recent_event_keys__ = new Map<string, number>()
  }
  return globalThis.__veilpay_recent_event_keys__
}

export interface RecordActivityInput {
  authUserId: string
  merchantId?: string | null
  intentId?: string | null
  eventType: ActivityEventType
  title: string
  description: string
  metadata?: Record<string, unknown>
}

/**
 * Persistently records an authoritative merchant activity event.
 * Includes idempotency deduplication to prevent double-logging from quick retries.
 */
export async function recordActivityEvent(
  input: RecordActivityInput,
): Promise<ActivityRecord | null> {
  const { authUserId, merchantId, intentId, eventType, title, description, metadata = {} } = input

  if (!authUserId) {
    return null
  }

  // Idempotency check: prevent duplicate events within 5 seconds for same user/intent/type
  const dedupeKey = `${authUserId}:${intentId || 'global'}:${eventType}`
  const now = Date.now()
  const recentEvents = getRecentEventMap()
  const lastRecorded = recentEvents.get(dedupeKey)

  if (lastRecorded && now - lastRecorded < 5000) {
    return null
  }
  recentEvents.set(dedupeKey, now)

  // Prune map if large
  if (recentEvents.size > 200) {
    for (const [k, ts] of recentEvents.entries()) {
      if (now - ts > 30000) recentEvents.delete(k)
    }
  }

  const newActivity: ActivityRecord = {
    id: `act_${crypto.randomUUID()}`,
    authUserId,
    merchantId: merchantId ?? null,
    intentId: intentId ?? null,
    eventType,
    title,
    description,
    metadata,
    isRead: false,
    createdAt: new Date().toISOString(),
  }

  // 1. Store in memory store
  const store = getActivityStore()
  store.unshift(newActivity)
  if (store.length > 500) {
    store.pop()
  }

  // 2. Persist to Supabase if configured
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('merchant_activity')
      .insert({
        auth_user_id: authUserId,
        merchant_id: merchantId ?? null,
        intent_id: intentId ?? null,
        event_type: eventType,
        title,
        description,
        metadata,
        is_read: false,
      })
      .select()
      .single()

    if (!error && data) {
      newActivity.id = data.id
      newActivity.createdAt = data.created_at
      return newActivity
    }
  } catch (err) {
    console.warn('[VeilPay] Activity DB write note:', err)
  }

  return newActivity
}

export interface ListActivitiesQuery {
  authUserId: string
  eventType?: string
  intentId?: string
  page?: number
  limit?: number
  unreadOnly?: boolean
}

/**
 * Authoritatively retrieves activities for the authenticated merchant.
 * Strictly scopes query by authUserId to prevent IDOR and cross-merchant leakage.
 */
export async function listMerchantActivities(
  query: ListActivitiesQuery,
): Promise<ActivityListResponse> {
  const { authUserId, eventType, intentId, page = 1, limit = 15, unreadOnly } = query
  const offset = (page - 1) * limit

  try {
    const supabase = await createClient()

    let dbQuery = supabase
      .from('merchant_activity')
      .select('*', { count: 'exact' })
      .eq('auth_user_id', authUserId)
      .order('created_at', { ascending: false })

    if (eventType && eventType !== 'ALL') {
      dbQuery = dbQuery.eq('event_type', eventType)
    }

    if (intentId && intentId.trim()) {
      const sanitized = intentId.trim().slice(0, 64).replace(/[%_]/g, '')
      if (sanitized) {
        dbQuery = dbQuery.ilike('intent_id', `%${sanitized}%`)
      }
    }

    if (unreadOnly) {
      dbQuery = dbQuery.eq('is_read', false)
    }

    // Apply pagination
    dbQuery = dbQuery.range(offset, offset + limit - 1)

    const { data, count, error } = await dbQuery

    // Also get unread count
    const { count: unreadCount, error: unreadErr } = await supabase
      .from('merchant_activity')
      .select('id', { count: 'exact', head: true })
      .eq('auth_user_id', authUserId)
      .eq('is_read', false)

    if (!error && data !== null) {
      const activities: ActivityRecord[] = data.map((row) => ({
        id: row.id,
        authUserId: row.auth_user_id,
        merchantId: row.merchant_id,
        intentId: row.intent_id,
        eventType: row.event_type as ActivityEventType,
        title: row.title,
        description: row.description,
        metadata: (row.metadata as Record<string, unknown>) || {},
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
      }))

      const total = count ?? activities.length
      const totalPages = Math.max(1, Math.ceil(total / limit))

      return {
        activities,
        total,
        page,
        limit,
        totalPages,
        unreadCount: unreadErr ? 0 : (unreadCount ?? 0),
      }
    }
  } catch (err) {
    console.warn('[VeilPay] Activity DB read note:', err)
  }

  // Fallback to local memory store
  const store = getActivityStore()
  let filtered = store.filter((a) => a.authUserId === authUserId)

  if (eventType && eventType !== 'ALL') {
    filtered = filtered.filter((a) => a.eventType === eventType)
  }
  if (intentId && intentId.trim()) {
    filtered = filtered.filter((a) =>
      a.intentId?.toLowerCase().includes(intentId.trim().toLowerCase()),
    )
  }
  if (unreadOnly) {
    filtered = filtered.filter((a) => !a.isRead)
  }

  const unreadCount = store.filter((a) => a.authUserId === authUserId && !a.isRead).length
  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const paginated = filtered.slice(offset, offset + limit)

  return {
    activities: paginated,
    total,
    page,
    limit,
    totalPages,
    unreadCount,
  }
}

/**
 * Marks one or all activities as read for the authenticated merchant.
 */
export async function markActivitiesAsRead(
  authUserId: string,
  options: { activityId?: string; markAll?: boolean },
): Promise<{ success: boolean; count: number }> {
  const { activityId, markAll } = options

  // In memory update
  const store = getActivityStore()
  let updatedCount = 0

  for (const item of store) {
    if (item.authUserId === authUserId) {
      if (markAll || item.id === activityId) {
        if (!item.isRead) {
          item.isRead = true
          updatedCount++
        }
      }
    }
  }

  // DB update
  try {
    const supabase = await createClient()

    if (markAll) {
      const { data, error } = await supabase
        .from('merchant_activity')
        .update({ is_read: true })
        .eq('auth_user_id', authUserId)
        .eq('is_read', false)
        .select('id')

      if (!error && data) {
        return { success: true, count: data.length }
      }
    } else if (activityId) {
      const { data, error } = await supabase
        .from('merchant_activity')
        .update({ is_read: true })
        .eq('auth_user_id', authUserId)
        .eq('id', activityId)
        .select('id')

      if (!error && data) {
        return { success: true, count: data.length }
      }
    }
  } catch (err) {
    console.warn('[VeilPay] Activity DB update note:', err)
  }

  return { success: true, count: updatedCount }
}
