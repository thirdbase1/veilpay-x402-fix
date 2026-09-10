import { NextResponse } from 'next/server'
import {
  getServerIntent,
  updateServerIntentStatus,
} from '@/lib/payments/server-store'

export const dynamic = 'force-dynamic'

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
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

    const updated = updateServerIntentStatus(id, 'cancelled')
    return NextResponse.json({ intent: updated })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
