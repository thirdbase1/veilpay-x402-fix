import { NextResponse } from 'next/server'
import {
  getServerIntent,
  updateServerIntentStatus,
} from '@/lib/payments/server-store'
import { getMidnightClient } from '@/lib/midnight/client'
import { createClient } from '@/lib/supabase/server'
import { recordActivityEvent } from '@/lib/payments/activity'
import { isValidIntentId, isValidAddress } from '@/lib/payments/intent'
import type { PaymentIntent, PaymentIntentStatus } from '@/lib/payments/types'

export const dynamic = 'force-dynamic'

interface PayRequestBody {
  payerAddress?: string
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

    // 1. Fetch intent from Supabase first
    const supabase = await createClient()
    const { data: dbIntent } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    let currentStatus: PaymentIntentStatus = 'awaiting_payment'
    let expiresAt: string | undefined = undefined
    let authUserId: string | null = null

    if (dbIntent) {
      currentStatus = dbIntent.status as PaymentIntentStatus
      expiresAt = dbIntent.expires_at ?? undefined
      authUserId = dbIntent.auth_user_id
    } else {
      const memIntent = getServerIntent(id)
      if (!memIntent) {
        return NextResponse.json(
          { success: false, error: 'Payment intent not found in protocol registry' },
          { status: 404 },
        )
      }
      currentStatus = memIntent.status
      expiresAt = memIntent.conditions.expiresAt
    }

    // 2. Check expiration
    if (
      currentStatus === 'expired' ||
      (expiresAt && new Date(expiresAt).getTime() <= Date.now())
    ) {
      if (dbIntent) {
        await supabase
          .from('payment_intents')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', id)
      }
      updateServerIntentStatus(id, 'expired')

      return NextResponse.json(
        {
          success: false,
          status: 'expired',
          code: 'INTENT_EXPIRED',
          error: 'This payment intent has expired and can no longer be satisfied.',
        },
        { status: 409 },
      )
    }

    // 3. Check cancellation
    if (currentStatus === 'cancelled') {
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

    // 4. Check if already verified
    if (currentStatus === 'verified') {
      return NextResponse.json(
        {
          success: true,
          status: 'verified',
          code: 'ALREADY_VERIFIED',
          message: 'Payment intent has already been verified.',
        },
        { status: 200 },
      )
    }

    // 5. Check if failed
    if (currentStatus === 'failed') {
      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          code: 'INTENT_FAILED',
          error: 'Payment intent has failed and cannot be paid.',
        },
        { status: 409 },
      )
    }

    // 6. Parse and validate payer address
    const body: PayRequestBody = await request.json().catch(() => ({}))
    const payerAddress = body.payerAddress?.trim()

    if (!payerAddress || !isValidAddress(payerAddress)) {
      return NextResponse.json(
        {
          success: false,
          status: currentStatus,
          code: 'WALLET_REQUIRED',
          error: 'A valid connected payer account address is required (8-128 alphanumeric characters).',
        },
        { status: 400 },
      )
    }

    // 7. Delegate to Midnight client boundary
    const midnight = getMidnightClient()

    if (!midnight.ready) {
      // Truthful protocol state: the repository does not have a deployed contract
      return NextResponse.json(
        {
          success: false,
          status: currentStatus,
          code: 'MIDNIGHT_INTEGRATION_PENDING',
          message:
            'Midnight contract & proof-server integration is pending. Real ZK proof generation and contract verification will execute once contract addresses and proving keys are deployed.',
          missingCapabilities: [
            'NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS: Deployed Compact contract address on Midnight network',
            'MIDNIGHT_PROOF_SERVER_URL: Local or remote prover endpoint for generating ZK proofs',
            'MIDNIGHT_INDEXER_RPC_URL: RPC endpoint to verify on-chain ledger state',
          ],
        },
        { status: 503 },
      )
    }

    // If client is ready, update state to verifying and execute real verification
    if (dbIntent) {
      await supabase
        .from('payment_intents')
        .update({ status: 'verifying', updated_at: new Date().toISOString() })
        .eq('id', id)
    }
    updateServerIntentStatus(id, 'verifying')

    const verificationResult = await midnight.verify(id)

    if (verificationResult.satisfied) {
      const now = new Date().toISOString()
      if (dbIntent) {
        await supabase
          .from('payment_intents')
          .update({ status: 'verified', updated_at: now })
          .eq('id', id)

        if (authUserId) {
          await recordActivityEvent({
            authUserId,
            intentId: id,
            eventType: 'PAYMENT_VERIFIED',
            title: 'Payment Verified',
            description: `Payment intent ${id} was verified on-chain.`,
            metadata: {
              payerAddress,
              network: body.network || 'midnight-testnet',
            },
          })
        }
      }
      const verifiedIntent = updateServerIntentStatus(id, 'verified')

      return NextResponse.json({
        success: true,
        status: 'verified',
        intent: verifiedIntent,
        verificationResult,
      })
    } else {
      if (dbIntent) {
        await supabase
          .from('payment_intents')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', id)
      }
      const failedIntent = updateServerIntentStatus(id, 'failed')

      return NextResponse.json(
        {
          success: false,
          status: 'failed',
          intent: failedIntent,
          error: 'Zero-knowledge verification failed: Payment conditions were not satisfied.',
        },
        { status: 422 },
      )
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    )
  }
}
