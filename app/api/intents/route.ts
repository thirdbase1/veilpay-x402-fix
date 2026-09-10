import { NextResponse } from 'next/server'
import {
  listServerIntents,
  saveServerIntent,
} from '@/lib/payments/server-store'
import { validateConditions, buildDraftIntent } from '@/lib/payments/intent'
import { getMidnightClient } from '@/lib/midnight/client'
import { midnightPublicConfig } from '@/lib/config'
import type { PaymentConditions, PaymentIntent } from '@/lib/payments/types'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const recipient = searchParams.get('recipient') ?? undefined

    // Check if user is authenticated with Supabase
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      // Query persistent payment intents owned by this merchant user
      const { data: dbIntents, error } = await supabase
        .from('payment_intents')
        .select('*')
        .eq('auth_user_id', user.id)
        .order('created_at', { ascending: false })

      if (!error && dbIntents && dbIntents.length > 0) {
        // Map database records back to PaymentIntent interface
        const mapped: PaymentIntent[] = dbIntents.map((row) => ({
          id: row.id,
          network: row.network,
          status: row.status,
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
        return NextResponse.json({ intents: mapped })
      }
    }

    // Fallback to volatile in-memory store
    const intents = listServerIntents(recipient)
    return NextResponse.json({ intents })
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
          network: saved.network ?? midnightPublicConfig.network,
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
