import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordActivityEvent } from '@/lib/payments/activity'
import { isValidIntentId } from '@/lib/payments/intent'
import type { PaymentIntentStatus } from '@/lib/payments/types'
import {
  getVeilPayReadiness,
  getChainIntent,
  VeilPayUnavailableError,
  type VeilPayChainIntent,
} from '@/lib/veilpay-server'

export const dynamic = 'force-dynamic'

/**
 * Settlement verification for a client-side pay.
 *
 * Per docs/MIGRATION-V2-INVOICE.md, the customer pays from their own wallet:
 * the browser extension signs `pay(intentId, coin)` with a funded shielded
 * coin and the claim code never leaves the payer's machine. The server never
 * submits transactions — this endpoint reads the authoritative public ledger
 * and persists the verified result once the chain shows settlement.
 */

interface PayRequestBody {
  network?: string
  /** Correlation reference of the wallet-broadcast transaction (optional). */
  txReference?: string
}

interface DbIntentRow {
  auth_user_id?: string | null
  status?: string
  expires_at?: string | null
  metadata?: { chainIntentId?: string } | null
  [key: string]: unknown
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  let id = ''
  let supabase: Awaited<ReturnType<typeof createClient>> | null = null
  let dbIntent: DbIntentRow | null = null
  let meta: { chainIntentId?: string } = {}

  try {
    const params = await context.params
    id = params.id

    if (!isValidIntentId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment intent ID format' },
        { status: 400 },
      )
    }

    // 1. Load the authoritative intent record
    supabase = await createClient()
    const { data } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    dbIntent = (data as DbIntentRow) ?? null

    if (!dbIntent) {
      return NextResponse.json(
        { success: false, error: 'Payment intent not found in protocol registry' },
        { status: 404 },
      )
    }

    meta = (dbIntent.metadata ?? {}) as { chainIntentId?: string }

    if (!meta.chainIntentId) {
      return NextResponse.json(
        {
          success: false,
          error:
            'This payment intent is not registered on the VeilPay contract and cannot be paid.',
        },
        { status: 409 },
      )
    }

    // 2. Registry-side liveness checks (chain state remains authoritative)
    if (dbIntent.status === 'cancelled') {
      return NextResponse.json(
        {
          success: false,
          status: 'cancelled',
          code: 'INTENT_CANCELLED',
          error: 'This payment intent was cancelled by the merchant.',
        },
        { status: 409 },
      )
    }

    const isExpired =
      dbIntent.status === 'expired' ||
      (typeof dbIntent.expires_at === 'string' &&
        new Date(dbIntent.expires_at).getTime() <= Date.now())
    if (isExpired) {
      if (dbIntent.status !== 'expired') {
        await supabase
          .from('payment_intents')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', id)
      }
      return NextResponse.json(
        {
          success: false,
          status: 'expired',
          code: 'INTENT_EXPIRED',
          error: 'This payment intent has expired and can no longer be paid.',
        },
        { status: 410 },
      )
    }

    // 3. Protocol stack must be ready
    const readiness = getVeilPayReadiness()
    if (!readiness.ready) {
      return NextResponse.json(
        {
          success: false,
          code: 'VEILPAY_NOT_CONFIGURED',
          message: 'VeilPay protocol integration is not ready.',
          missingCapabilities: readiness.missing,
        },
        { status: 503 },
      )
    }

    const body: PayRequestBody = await request.json().catch(() => ({}))
    const txReference =
      typeof body.txReference === 'string' && body.txReference.length <= 256
        ? body.txReference
        : undefined

    // 4. Read authoritative on-chain state. The customer's wallet has (or is
    // about to) broadcast the pay tx; the ledger is the source of truth.
    let chain = await getChainIntent(meta.chainIntentId)
    if (!chain) {
      return NextResponse.json(
        { success: false, error: 'Invoice not found in the VeilPay contract ledger.' },
        { status: 404 },
      )
    }

    // 5. If the pay tx was just broadcast, the indexer lags the block that
    // settled it — poll the ledger briefly before giving up.
    if (chain.status === 'ACTIVE') {
      let polled: VeilPayChainIntent | null = chain
      for (let attempt = 0; attempt < 20 && polled?.status === 'ACTIVE'; attempt++) {
        await new Promise((r) => setTimeout(r, 3_000))
        polled = await getChainIntent(meta.chainIntentId)
      }
      if (polled) chain = polled
    }

    if (chain.status === 'ACTIVE') {
      return NextResponse.json(
        {
          success: false,
          status: 'awaiting_payment',
          code: 'PAYMENT_NOT_SETTLED',
          error:
            'The invoice is still open on-chain. Complete the payment in your wallet, then verify again.',
        },
        { status: 422 },
      )
    }

    if (chain.status === 'CANCELLED') {
      await supabase
        .from('payment_intents')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)

      return NextResponse.json(
        {
          success: false,
          status: 'cancelled',
          code: 'INTENT_CANCELLED',
          error: 'This payment intent was cancelled by the merchant.',
        },
        { status: 409 },
      )
    }

    // 6. Persist verified state and activity
    const now = new Date().toISOString()
    await supabase
      .from('payment_intents')
      .update({
        status: 'verified',
        updated_at: now,
        ...(txReference ? { on_chain_reference: txReference } : {}),
      })
      .eq('id', id)

    if (dbIntent.auth_user_id) {
      await recordActivityEvent({
        authUserId: dbIntent.auth_user_id,
        intentId: id,
        eventType: 'PAYMENT_VERIFIED',
        title: 'Payment Verified',
        description: `Payment intent ${id} (chain #${meta.chainIntentId}) was verified on-chain.`,
        metadata: {
          chainIntentId: meta.chainIntentId,
          network: body.network || 'midnight-preprod',
        },
      })
    }

    return NextResponse.json({
      success: true,
      status: 'verified' as PaymentIntentStatus,
      chainIntentId: meta.chainIntentId,
      receipt: chain.receipt,
      message: 'Payment verified against the VeilPay contract.',
    })
  } catch (err: unknown) {
    if (err instanceof VeilPayUnavailableError) {
      return NextResponse.json(
        { success: false, error: err.message, missingCapabilities: err.missing },
        { status: 503 },
      )
    }
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
