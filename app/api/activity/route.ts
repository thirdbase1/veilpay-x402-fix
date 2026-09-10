import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { listMerchantActivities, markActivitiesAsRead } from '@/lib/payments/activity'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Merchant authentication required' },
        { status: 401 },
      )
    }

    const { searchParams } = new URL(request.url)
    const eventType = searchParams.get('eventType') || undefined
    const intentId = searchParams.get('intentId') || undefined
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '15', 10)))
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    const data = await listMerchantActivities({
      authUserId: user.id,
      eventType,
      intentId,
      page,
      limit,
      unreadOnly,
    })

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve activity log'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized: Merchant authentication required' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const activityId = typeof body.activityId === 'string' ? body.activityId : undefined
    const markAll = Boolean(body.markAll)

    const result = await markActivitiesAsRead(user.id, {
      activityId,
      markAll,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update activity status'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
