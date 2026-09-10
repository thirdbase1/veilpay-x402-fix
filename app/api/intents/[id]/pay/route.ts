import { NextResponse } from 'next/server'
import {
  getServerIntent,
  updateServerIntentStatus,
} from '@/lib/payments/server-store'
import { getMidnightClient } from '@/lib/midnight/client'

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
    const intent = getServerIntent(id)

    if (!intent) {
      return NextResponse.json(
        { success: false, error: 'Payment intent not found in protocol registry' },
        { status: 404 },
      )
    }

    // 1. Check expiration
    if (
      intent.status === 'expired' ||
      (intent.conditions.expiresAt &&
        new Date(intent.conditions.expiresAt).getTime() < Date.now())
    ) {
      updateServerIntentStatus(id, 'expired')
      return NextResponse.json(
        {
          success: false,
          status: 'expired',
          code: 'INTENT_EXPIRED',
          error: 'This payment intent has expired and can no longer be satisfied.',
        },
        { status: 400 },
      )
    }

    // 2. Check cancellation
    if (intent.status === 'cancelled') {
      return NextResponse.json(
        {
          success: false,
          status: 'cancelled',
          code: 'INTENT_CANCELLED',
          error: 'This payment intent was cancelled by the merchant.',
        },
        { status: 400 },
      )
    }

    // 3. Duplicate payment protection: check if already verified
    if (intent.status === 'verified') {
      return NextResponse.json(
        {
          success: true,
          status: 'verified',
          code: 'ALREADY_VERIFIED',
          intent,
          message: 'Payment intent has already been verified.',
        },
        { status: 200 },
      )
    }

    // Parse and validate body
    let body: PayRequestBody = {}
    try {
      body = await request.json()
    } catch {
      // Empty or non-JSON body allowed if only triggering
    }

    const payerAddress = body.payerAddress?.trim()
    if (!payerAddress) {
      return NextResponse.json(
        {
          success: false,
          status: intent.status,
          code: 'WALLET_REQUIRED',
          error: 'A valid connected payer account address is required to submit payment.',
        },
        { status: 400 },
      )
    }

    // 4. Delegate to the Midnight client boundary
    const midnight = getMidnightClient()

    if (!midnight.ready) {
      // Truthful protocol state: the repository does not have a deployed contract
      // or connected proof server. We NEVER fabricate a successful proof or transaction.
      return NextResponse.json(
        {
          success: false,
          status: intent.status,
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
    updateServerIntentStatus(id, 'verifying')

    const verificationResult = await midnight.verify(id)

    if (verificationResult.satisfied) {
      const verifiedIntent = updateServerIntentStatus(id, 'verified')
      return NextResponse.json({
        success: true,
        status: 'verified',
        intent: verifiedIntent,
        verificationResult,
      })
    } else {
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
