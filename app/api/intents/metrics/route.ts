import { NextResponse } from 'next/server'
import { computeServerMetrics } from '@/lib/payments/server-store'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const recipient = searchParams.get('recipient') ?? undefined
    const metrics = computeServerMetrics(recipient)
    return NextResponse.json(metrics)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
