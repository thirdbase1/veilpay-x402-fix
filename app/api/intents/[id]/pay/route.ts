import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recordActivityEvent } from '@/lib/payments/activity'
import { isValidIntentId } from '@/lib/payments/intent'
import type { PaymentIntentStatus } from '@/lib/payments/types'
import {
  getVeilPayAPI,
  getVeilPayReadiness,
  getChainIntent,
  mapChainStatusToAppStatus,
  isValidPaymentSecretHex,
  secretToBytes,
  VeilPayUnavailableError,
} from '@/lib/veilpay-server'

export const dynamic = 'force-dynamic'

interface PayRequestBody {
  /** 32-byte payment secret from the checkout link fragment (hex encoded). */
  paymentSecret?: string
  network?: string
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params

    if (!isValidIntentId(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid payment intent ID format' },
        { status: 400 },
      )
    }

    // 1. Load the authoritative intent record
    const supabase = await createClient()
    const { data: dbIntent } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!dbIntent) {
      return NextResponse.json(
        { success: false, error: 'Payment intent not found in protocol registry' },
        { status: 404 },
      )
    }

    const meta = (dbIntent.metadata ?? {}) as {
      chainIntentId?: string
      paymentSecret?: string
      expiresAtOps?: string
    }

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

    // 2. The payment secret is the payer's credential — required, no wallet address.
    const body: PayRequestBody = await request.json().catch(() => ({}))
    const paymentSecret = body.paymentSecret?.trim()

    if (!isValidPaymentSecretHex(paymentSecret)) {
      return NextResponse.json(
        {
          success: false,
          code: 'PAYMENT_SECRET_REQUIRED',
          error:
            'A valid 32-byte payment secret (64 hex characters) from the checkout link is required.',
        },
        { status: 400 },
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

    const api = await getVeilPayAPI()
    const chainId = BigInt(meta.chainIntentId)

    // 4. Read authoritative on-chain state before paying
    const before = await getChainIntent(api, meta.chainIntentId)
    if (!before) {
      return NextResponse.json(
        { success: false, error: 'Intent not found in the VeilPay contract ledger.' },
        { status: 404 },
      )
    }

    if (before.status === 'PAID' || before.status === 'REFUNDED') {
      const now = new Date().toISOString()
      await supabase
        .from('payment_intents')
        .update({ status: 'verified', updated_at: now })
        .eq('id', id)

      return NextResponse.json({
        success: true,
        status: 'verified',
        code: 'ALREADY_VERIFIED',
        message: 'Payment intent has already been satisfied on-chain.',
      })
    }

    if (before.status === 'CANCELLED') {
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

    // 5. Submit the real pay circuit call through the authenticated gateway
    await api.pay(chainId, secretToBytes(paymentSecret))

    // 6. Confirm settlement from the ledger
    const after = await getChainIntent(api, meta.chainIntentId)
    const settled = after?.status === 'PAID' || after?.status === 'REFUNDED'

    if (!settled) {
      return NextResponse.json(
        {
          success: false,
          status: 'awaiting_payment',
          code: 'PAYMENT_NOT_SETTLED',
          error:
            'The pay transaction did not settle. Check the payment secret and try again.',
        },
        { status: 422 },
      )
    }

    // 7. Persist verified state and activity
    const now = new Date().toISOString()
    await supabase
      .from('payment_intents')
      .update({ status: 'verified', updated_at: now })
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
