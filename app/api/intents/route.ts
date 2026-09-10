import { NextResponse } from 'next/server'
import {
  listServerIntents,
  saveServerIntent,
} from '@/lib/payments/server-store'
import { validateConditions, buildDraftIntent } from '@/lib/payments/intent'
import { getMidnightClient } from '@/lib/midnight/client'
import { midnightPublicConfig } from '@/lib/config'
import type { PaymentConditions } from '@/lib/payments/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const recipient = searchParams.get('recipient') ?? undefined
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
        const saved = saveServerIntent(onChain)
        return NextResponse.json({ intent: saved, midnightStatus: 'published' }, { status: 201 })
      } catch (chainErr) {
        // Log protocol error without crashing intent draft
        console.error('[VeilPay] Midnight registration error:', chainErr)
      }
    }

    // Set intent to active awaiting payment in protocol state
    draft.status = 'awaiting_payment'
    const saved = saveServerIntent(draft)

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
