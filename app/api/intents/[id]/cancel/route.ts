import { NextResponse } from 'next/server'
import {
  getServerIntent,
  updateServerIntentStatus,
} from '@/lib/payments/server-store'
import { createClient } from '@/lib/supabase/server'
import type { PaymentIntent } from '@/lib/payments/types'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params

    if (!id) {
      return NextResponse.json({ error: 'Intent ID is required' }, { status: 400 })
    }

    // Check Supabase session first
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      // Fetch authoritative state from database to check ownership and eligibility
      const { data: dbIntent, error: fetchError } = await supabase
        .from('payment_intents')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
      }

      if (dbIntent) {
        // Enforce merchant ownership server-side to prevent IDOR
        if (dbIntent.auth_user_id && dbIntent.auth_user_id !== user.id) {
          return NextResponse.json(
            { error: 'You do not have permission to cancel this payment intent.' },
            { status: 403 },
          )
        }

        // Check if intent is in an eligible state for cancellation
        if (dbIntent.status === 'verified') {
          return NextResponse.json(
            { error: 'Cannot cancel an already verified payment intent.' },
            { status: 400 },
          )
        }

        if (dbIntent.status === 'expired') {
          return NextResponse.json(
            { error: 'Cannot cancel an already expired payment intent.' },
            { status: 400 },
          )
        }

        if (dbIntent.status === 'cancelled') {
          return NextResponse.json(
            { error: 'This payment intent has already been cancelled.' },
            { status: 400 },
          )
        }

        if (dbIntent.status === 'failed') {
          return NextResponse.json(
            { error: 'Cannot cancel a failed payment intent.' },
            { status: 400 },
          )
        }

        const now = new Date().toISOString()
        const { data: updatedDb, error: updateError } = await supabase
          .from('payment_intents')
          .update({
            status: 'cancelled',
            updated_at: now,
          })
          .eq('id', id)
          .eq('auth_user_id', user.id)
          .select('*')
          .single()

        if (updateError || !updatedDb) {
          return NextResponse.json(
            { error: updateError?.message || 'Failed to update intent status' },
            { status: 500 },
          )
        }

        // Sync in-memory store if present
        updateServerIntentStatus(id, 'cancelled')

        const mapped: PaymentIntent = {
          id: updatedDb.id,
          network: updatedDb.network,
          status: 'cancelled',
          conditions: {
            amount: {
              kind: updatedDb.amount_kind,
              asset: updatedDb.asset,
              amount: updatedDb.amount,
              amountMax: updatedDb.amount_max ?? undefined,
            },
            recipient: updatedDb.recipient,
            expiresAt: updatedDb.expires_at ?? undefined,
            reference: updatedDb.reference ?? undefined,
          },
          createdAt: updatedDb.created_at,
          updatedAt: updatedDb.updated_at,
          onChainReference: updatedDb.reference ?? undefined,
        }

        return NextResponse.json({ intent: mapped })
      }
    }

    // In-memory server store fallback (e.g. guest / local development)
    const existing = getServerIntent(id)

    if (!existing) {
      return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 })
    }

    if (existing.status === 'verified') {
      return NextResponse.json(
        { error: 'Cannot cancel a verified payment intent' },
        { status: 400 },
      )
    }

    if (existing.status === 'expired') {
      return NextResponse.json(
        { error: 'Payment intent has already expired' },
        { status: 400 },
      )
    }

    if (existing.status === 'cancelled') {
      return NextResponse.json(
        { error: 'Payment intent is already cancelled' },
        { status: 400 },
      )
    }

    if (existing.status === 'failed') {
      return NextResponse.json(
        { error: 'Cannot cancel a failed payment intent' },
        { status: 400 },
      )
    }

    const updated = updateServerIntentStatus(id, 'cancelled')
    return NextResponse.json({ intent: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
