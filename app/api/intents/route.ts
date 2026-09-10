import { NextResponse } from 'next/server'
import {
  listServerIntents,
  saveServerIntent,
} from '@/lib/payments/server-store'
import { validateConditions, buildDraftIntent } from '@/lib/payments/intent'
import { getMidnightClient } from '@/lib/midnight/client'
import { midnightPublicConfig } from '@/lib/config'
import type { PaymentConditions, PaymentIntent, PaymentIntentStatus } from '@/lib/payments/types'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const recipient = searchParams.get('recipient') ?? undefined
    const search = searchParams.get('search')?.trim().toLowerCase() || ''
    const statusFilter = searchParams.get('status') || 'all'
    const sortBy = searchParams.get('sort') || 'newest'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('pageSize') || '10', 10)))

    // Check if user is authenticated with Supabase
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      // Query persistent payment intents strictly owned by this merchant user
      let query = supabase
        .from('payment_intents')
        .select('*', { count: 'exact' })
        .eq('auth_user_id', user.id)

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
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

      if (!error && dbIntents !== null) {
        const total = count ?? dbIntents.length
        const totalPages = Math.max(1, Math.ceil(total / pageSize))

        // Map database records back to PaymentIntent interface
        const mapped: PaymentIntent[] = dbIntents.map((row) => ({
          id: row.id,
          network: row.network,
          status: row.status as PaymentIntentStatus,
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
        }))

        return NextResponse.json({
          intents: mapped,
          total,
          page,
          pageSize,
          totalPages,
        })
      }
    }

    // Fallback to volatile in-memory store (e.g. for guest / dev mode)
    let intents = listServerIntents(recipient)

    // Apply status filter
    if (statusFilter && statusFilter !== 'all') {
      intents = intents.filter((i) => i.status === statusFilter)
    }

    // Apply search filter
    if (search) {
      intents = intents.filter((i) => {
        const matchId = i.id.toLowerCase().includes(search)
        const matchRef = i.conditions.reference?.toLowerCase().includes(search) ?? false
        const matchRecipient = i.conditions.recipient.toLowerCase().includes(search)
        const matchStatus = i.status.toLowerCase().includes(search)
        return matchId || matchRef || matchRecipient || matchStatus
      })
    }

    // Apply sorting
    intents.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        case 'amount_desc':
          return parseFloat(b.conditions.amount.amount || '0') - parseFloat(a.conditions.amount.amount || '0')
        case 'amount_asc':
          return parseFloat(a.conditions.amount.amount || '0') - parseFloat(b.conditions.amount.amount || '0')
        case 'expires_asc': {
          const expA = a.conditions.expiresAt ? new Date(a.conditions.expiresAt).getTime() : Infinity
          const expB = b.conditions.expiresAt ? new Date(b.conditions.expiresAt).getTime() : Infinity
          return expA - expB
        }
        case 'status':
          return a.status.localeCompare(b.status)
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

    const total = intents.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const paginated = intents.slice((page - 1) * pageSize, page * pageSize)

    return NextResponse.json({
      intents: paginated,
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
    const body = await request.json()
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
        { status: 422 },
      )
    }

    // Assemble the typed intent
    const draft = buildDraftIntent(conditions, {
      network: midnightPublicConfig.network,
    })

    const midnightClient = getMidnightClient()
    let midnightStatus: 'published' | 'integration_pending' = 'integration_pending'

    // If Midnight client is configured, register on-chain
    if (midnightClient.ready) {
      try {
        const onChain = await midnightClient.createIntent(draft)
        draft.status = onChain.status
        draft.onChainReference = onChain.onChainReference
        midnightStatus = 'published'
      } catch (chainErr) {
        // Log protocol error without crashing intent draft
        console.error('[VeilPay] Midnight registration error:', chainErr)
      }
    } else {
      // Set intent to active awaiting payment in protocol state
      draft.status = 'awaiting_payment'
    }

    // Save in server store
    const saved = saveServerIntent(draft)

    // Also persist in Supabase if user is authenticated
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from('merchant_profiles')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle()

        await supabase.from('payment_intents').insert({
          id: saved.id,
          merchant_id: profile?.id ?? null,
          auth_user_id: user.id,
          network: saved.network || midnightPublicConfig.network || 'midnight-testnet',
          status: saved.status,
          amount_kind: saved.conditions.amount.kind,
          asset: saved.conditions.amount.asset,
          amount: saved.conditions.amount.amount,
          amount_max: saved.conditions.amount.amountMax ?? null,
          recipient: saved.conditions.recipient,
          expires_at: saved.conditions.expiresAt ?? null,
          reference: saved.conditions.reference ?? null,
          metadata: {},
          created_at: saved.createdAt,
          updated_at: saved.updatedAt ?? saved.createdAt,
        })
      }
    } catch (dbErr) {
      console.warn('[VeilPay] Supabase intent sync notice:', dbErr)
    }

    return NextResponse.json(
      {
        intent: saved,
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
