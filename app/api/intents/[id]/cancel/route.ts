import { NextResponse } from 'next/server'
import {
  getServerIntent,
  updateServerIntentStatus,
} from '@/lib/payments/server-store'
import { createClient } from '@/lib/supabase/server'
import type { PaymentIntent, PaymentIntentStatus } from '@/lib/payments/types'
import { recordActivityEvent } from '@/lib/payments/activity'
import { isValidIntentId } from '@/lib/payments/intent'
import {
  getVeilPayReadiness,
  getChainIntent,
  VeilPayUnavailableError,
} from '@/lib/veilpay-server'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params

    if (!isValidIntentId(id)) {
      return NextResponse.json({ error: 'Invalid intent ID format' }, { status: 400 })
    }

    // Strict merchant authentication requirement
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Merchant authentication required to cancel intents' },
        { status: 401 },
      )
    }

    // Fetch authoritative state from database to check ownership and eligibility
    const { data: dbIntent, error: fetchError } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (fetchError) {
      return NextResponse.json({ error: 'Failed to retrieve invoice' }, { status: 500 })
    }

    if (!dbIntent) {
      return NextResponse.json({ error: 'Invoice not found in protocol registry' }, { status: 404 })
    }

    // Enforce merchant ownership server-side to prevent IDOR
    if (dbIntent.auth_user_id && dbIntent.auth_user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have permission to cancel this invoice.' },
        { status: 403 },
      )
    }

    // Check if intent is in an eligible state for cancellation
    if (dbIntent.status === 'verified' || dbIntent.status === 'paid') {
      return NextResponse.json(
        { error: 'Cannot cancel an already verified invoice.' },
        { status: 409 },
      )
    }

    if (dbIntent.status === 'expired') {
      return NextResponse.json(
        { error: 'Cannot cancel an already expired invoice.' },
        { status: 409 },
      )
    }

    if (dbIntent.status === 'cancelled') {
      return NextResponse.json(
        { error: 'This invoice has already been cancelled.', code: 'ALREADY_CANCELLED' },
        { status: 409 },
      )
    }

    if (dbIntent.status === 'failed') {
      return NextResponse.json(
        { error: 'Cannot cancel a failed invoice.' },
        { status: 409 },
      )
    }

    // Chain-backed invoices are cancelled by the merchant's wallet (the
    // extension signs the cancel tx — the server never holds keys). This
    // endpoint verifies the on-chain result and persists it.
    const meta = (dbIntent.metadata ?? {}) as { chainIntentId?: string }
    if (meta.chainIntentId) {
      const readiness = getVeilPayReadiness()
      if (!readiness.ready) {
        return NextResponse.json(
          {
            error: 'VeilPay protocol integration is not ready.',
            missingCapabilities: readiness.missing,
          },
          { status: 503 },
        )
      }
      try {
        const chain = await getChainIntent(meta.chainIntentId)
        if (!chain) {
          return NextResponse.json(
            { error: 'Invoice not found in the VeilPay contract ledger.' },
            { status: 404 },
          )
        }
        if (chain.status === 'ACTIVE') {
          return NextResponse.json(
            {
              error:
                'The invoice is still open on-chain. Cancel it from your wallet first, then confirm here.',
              code: 'CHAIN_CANCEL_REQUIRED',
            },
            { status: 409 },
          )
        }
        if (chain.status === 'PAID' || chain.status === 'REFUNDED') {
          return NextResponse.json(
            { error: 'Cannot cancel an already settled invoice.' },
            { status: 409 },
          )
        }
      } catch (chainErr) {
        if (chainErr instanceof VeilPayUnavailableError) {
          return NextResponse.json(
            { error: chainErr.message, missingCapabilities: chainErr.missing },
            { status: 503 },
          )
        }
        console.error('[VeilPay] Chain cancel verification failed:', chainErr)
        return NextResponse.json(
          { error: 'On-chain cancellation could not be verified.' },
          { status: 502 },
        )
      }
    }

    const now = new Date().toISOString()
    // Atomic update enforcing status transition and user ownership to prevent race conditions
    const { data: updatedDb, error: updateError } = await supabase
      .from('payment_intents')
      .update({
        status: 'cancelled',
        updated_at: now,
      })
      .eq('id', id)
      .eq('auth_user_id', user.id)
      .in('status', ['draft', 'open', 'awaiting_payment'])
      .select('*')
      .maybeSingle()

    if (updateError) {
      return NextResponse.json(
        { error: 'Database update failed' },
        { status: 500 },
      )
    }

    if (!updatedDb) {
      return NextResponse.json(
        { error: 'Intent status could not be transitioned or was modified concurrently.', code: 'CONCURRENT_MODIFICATION' },
        { status: 409 },
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

    // Record persistent cancel event
    await recordActivityEvent({
      authUserId: user.id,
      intentId: id,
      eventType: 'PAYMENT_INTENT_CANCELLED',
      title: 'Invoice Cancelled',
      description: `Invoice ${id} was cancelled by merchant.`,
      metadata: {
        amount: updatedDb.amount,
        asset: updatedDb.asset,
        recipient: updatedDb.recipient,
        reference: updatedDb.reference ?? null,
      },
    })

    return NextResponse.json({ intent: mapped })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
