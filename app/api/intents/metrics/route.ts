import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { DashboardMetrics } from '@/lib/payments/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Valid authenticated merchant session required' },
        { status: 401 },
      )
    }

    const { data: rows, error } = await supabase
      .from('payment_intents')
      .select('status, expires_at')
      .eq('auth_user_id', user.id)

    if (error) {
      return NextResponse.json({ error: 'Failed to compute metrics' }, { status: 500 })
    }

    const now = Date.now()
    const totalCount = rows?.length ?? 0
    let activeCount = 0
    let pendingCount = 0
    let verifiedCount = 0
    let expiredCount = 0

    for (const r of rows || []) {
      const isExpired = r.expires_at && new Date(r.expires_at).getTime() <= now
      if (r.status === 'verified') {
        verifiedCount++
      } else if (r.status === 'expired' || (isExpired && r.status !== 'cancelled' && r.status !== 'failed')) {
        expiredCount++
      } else if (r.status === 'verifying') {
        pendingCount++
      } else if (r.status === 'awaiting_payment' || r.status === 'open') {
        activeCount++
      }
    }

    const metrics: DashboardMetrics = {
      totalCount,
      activeCount,
      pendingCount,
      verifiedCount,
      expiredCount,
    }

    return NextResponse.json(metrics)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
