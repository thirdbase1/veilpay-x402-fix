import { NextResponse } from 'next/server'
import { computeServerMetrics } from '@/lib/payments/server-store'
import { createClient } from '@/lib/supabase/server'
import type { DashboardMetrics } from '@/lib/payments/types'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const recipient = searchParams.get('recipient') ?? undefined

    // Try computing metrics for authenticated user from Supabase
    try {
      const supabase = await createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: rows, error } = await supabase
          .from('payment_intents')
          .select('status')
          .eq('auth_user_id', user.id)

        if (!error && rows) {
          const totalCount = rows.length
          const activeCount = rows.filter((r) => r.status === 'awaiting_payment').length
          const pendingCount = rows.filter((r) => r.status === 'verifying').length
          const verifiedCount = rows.filter((r) => r.status === 'verified').length
          const expiredCount = rows.filter((r) => r.status === 'expired').length

          const metrics: DashboardMetrics = {
            totalCount,
            activeCount,
            pendingCount,
            verifiedCount,
            expiredCount,
          }

          return NextResponse.json(metrics)
        }
      }
    } catch {
      // Fallback below
    }

    // Fallback to memory store
    const metrics = computeServerMetrics(recipient)
    return NextResponse.json(metrics)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
