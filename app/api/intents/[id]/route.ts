import { NextResponse } from 'next/server'
import { getServerIntent } from '@/lib/payments/server-store'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    const intent = getServerIntent(id)

    if (!intent) {
      return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 })
    }

    return NextResponse.json({ intent })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
