import { NextResponse } from 'next/server'
import {
  listServerIntents,
  saveServerIntent,
  getServerIntent,
} from '@/lib/payments/server-store'
import {
  validateConditions,
  buildDraftIntent,
  isValidIntentId,
} from '@/lib/payments/intent'
import { getMidnightClient } from '@/lib/midnight/client'
import { midnightPublicConfig } from '@/lib/config'
import type { PaymentConditions, PaymentIntent, PaymentIntentStatus } from '@/lib/payments/types'
import { createClient } from '@/lib/supabase/server'
import { recordActivityEvent } from '@/lib/payments/activity'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS_FILTERS = [
  'all',
  'draft',
  'open',
  'awaiting_payment',
  'verifying',
  'paid',
  'verified',
  'expired',
  'failed',
  'cancelled',
] as const

const ALLOWED_SORTS = [
  'newest',
  'oldest',
  'amount_desc',
  'amount_asc',
  'expires_asc',
  'status',
] as const

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rawStatus = searchParams.get('status') || 'all'
    const sortBy = searchParams.get('sort') || 'newest'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1)
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') || searchParams.get('limit') || '10', 10) || 10))
    const rawSearch = searchParams.get('search')?.trim() || ''

    // Input bounds & validation
    if (!ALLOWED_STATUS_FILTERS.includes(rawStatus as typeof ALLOWED_STATUS_FILTERS[number])) {
      return NextResponse.json(
        { error: `Invalid status filter. Allowed values: ${ALLOWED_STATUS_FILTERS.join(', ')}` },
        { status: 400 },
      )
    }

    if (!ALLOWED_SORTS.includes(sortBy as typeof ALLOWED_SORTS[number])) {
      return NextResponse.json(
        { error: `Invalid sort field. Allowed values: ${ALLOWED_SORTS.join(', ')}` },
        { status: 400 },
      )
    }

    const search = rawSearch.slice(0, 100).replace(/[%_]/g, '')

    // Check if user is authenticated with Supabase
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid authenticated merchant session required' },
        { status: 401 },
      )
    }

    // Query persistent payment intents strictly owned by this merchant user
    let query = supabase
      .from('payment_intents')
      .select('*', { count: 'exact' })
      .eq('auth_user_id', user.id)

    if (rawStatus && rawStatus !== 'all') {
      query = query.eq('status', rawStatus)
    }

    if (search) {
      query = query.or(
        `id.ilike.%${search}%,reference.ilike.%${search}%,recipient.ilike.%${search}%`,
      )
    }

    // Apply sorting
    switch (sortBy) {
      case 'oldest':
        query = query.order('created_at', { ascending: true })
        break
      case 'amount_desc':
        query = query.order('amount', { ascending: false })
        break
      case 'amount_asc':
        query = query.order('amount', { ascending: true })
        break
      case 'expires_asc':
        query = query.order('expires_at', { ascending: true, nullsFirst: false })
        break
      case 'status':
        query = query.order('status', { ascending: true })
        break
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false })
        break
    }

    // Apply pagination range
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data: dbIntents, count, error } = await query

    if (error) {
      return NextResponse.json({ error: 'Failed to retrieve payment intents' }, { status: 500 })
    }

    const total = count ?? dbIntents?.length ?? 0
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const now = Date.now()

    // Map database records and check for automatic expiration
    const mapped: PaymentIntent[] = (dbIntents || []).map((row) => {
      let currentStatus = row.status as PaymentIntentStatus
      if (
        row.expires_at &&
        new Date(row.expires_at).getTime() <= now &&
        ['draft', 'open', 'awaiting_payment'].includes(currentStatus)
      ) {
        currentStatus = 'expired'
      }

      return {
        id: row.id,
        network: row.network,
        status: currentStatus,
        conditions: {
          amount: {
            kind: row.amount_kind,
            asset: row.asset,
            amount: row.amount,
            amountMax: row.amount_max ?? undefined,
          },
          recipient: row.recipient,
          expiresAt: row.expires_at ?? undefined,
          reference: row.reference ?? undefined,
        },
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        onChainReference: row.reference ?? undefined,
      }
    })

    return NextResponse.json({
      intents: mapped,
      total,
      page,
      pageSize,
      totalPages,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid authenticated merchant session required' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const conditions = body.conditions as PaymentConditions | undefined

    if (!conditions) {
      return NextResponse.json(
        { error: 'Payment conditions are required' },
        { status: 400 },
      )
    }

    const issues = validateConditions(conditions)
    if (issues.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', issues },
        { status: 400 },
      )
    }

    // Idempotency check: inspect Idempotency-Key header or optional body.id
    const idempotencyKey = request.headers.get('idempotency-key') || (typeof body.id === 'string' ? body.id : null)

    if (idempotencyKey && isValidIntentId(idempotencyKey)) {
      const { data: existing } = await supabase
        .from('payment_intents')
        .select('*')
        .eq('id', idempotencyKey)
        .maybeSingle()

      if (existing) {
        // Enforce ownership: must belong to the current merchant
        if (existing.auth_user_id !== user.id) {
          return NextResponse.json(
            { error: 'Idempotency conflict: intent belongs to another merchant.' },
            { status: 409 },
          )
        }

        const existingMapped: PaymentIntent = {
          id: existing.id,
          network: existing.network,
          status: existing.status as PaymentIntentStatus,
          conditions: {
            amount: {
              kind: existing.amount_kind,
              asset: existing.asset,
              amount: existing.amount,
              amountMax: existing.amount_max ?? undefined,
            },
            recipient: existing.recipient,
            expiresAt: existing.expires_at ?? undefined,
            reference: existing.reference ?? undefined,
          },
          createdAt: existing.created_at,
          updatedAt: existing.updated_at,
          onChainReference: existing.reference ?? undefined,
        }

        return NextResponse.json({
          intent: existingMapped,
          midnightStatus: 'integration_pending',
          isDuplicate: true,
        }, { status: 200 })
      }
    }

    // Assemble the authoritative typed intent
    const intentId = idempotencyKey && isValidIntentId(idempotencyKey) ? idempotencyKey : undefined
    const draft = buildDraftIntent(conditions, {
      id: intentId,
      network: midnightPublicConfig.network || 'midnight-testnet',
    })

    const midnightClient = getMidnightClient()
    let midnightStatus: 'published' | 'integration_pending' = 'integration_pending'

    if (midnightClient.ready) {
      try {
        const onChain = await midnightClient.createIntent(draft)
        draft.status = onChain.status
        draft.onChainReference = onChain.onChainReference
        midnightStatus = 'published'
      } catch (chainErr) {
        console.error('[VeilPay] Midnight registration error:', chainErr)
      }
    } else {
      draft.status = 'awaiting_payment'
    }

    // Fetch the merchant profile owned by user
    const { data: profile } = await supabase
      .from('merchant_profiles')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()

    // Save in persistent Supabase table with strict merchant ownership
    const { error: insertError } = await supabase.from('payment_intents').insert({
      id: draft.id,
      merchant_id: profile?.id ?? null,
      auth_user_id: user.id,
      network: draft.network || midnightPublicConfig.network || 'midnight-testnet',
      status: draft.status,
      amount_kind: draft.conditions.amount.kind,
      asset: draft.conditions.amount.asset,
      amount: draft.conditions.amount.amount,
      amount_max: draft.conditions.amount.amountMax ?? null,
      recipient: draft.conditions.recipient,
      expires_at: draft.conditions.expiresAt ?? null,
      reference: draft.conditions.reference ?? null,
      metadata: {},
      created_at: draft.createdAt,
      updated_at: draft.updatedAt ?? draft.createdAt,
    })

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to persist payment intent to database' },
        { status: 500 },
      )
    }

    // Sync in-memory store for fast local lookup
    saveServerIntent(draft)

    // Record persistent activity event
    await recordActivityEvent({
      authUserId: user.id,
      merchantId: profile?.id ?? null,
      intentId: draft.id,
      eventType: 'PAYMENT_INTENT_CREATED',
      title: 'Payment Intent Created',
      description: `Created payment intent for ${draft.conditions.amount.amount} ${draft.conditions.amount.asset}`,
      metadata: {
        amount: draft.conditions.amount.amount,
        asset: draft.conditions.amount.asset,
        recipient: draft.conditions.recipient,
        reference: draft.conditions.reference || null,
      },
    })

    return NextResponse.json(
      {
        intent: draft,
        midnightStatus,
        note: 'Saved in protocol intent store. Midnight contract integration boundary ready.',
      },
      { status: 201 },
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create intent'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
