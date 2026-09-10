import { NextResponse } from 'next/server'
import { getServerIntent } from '@/lib/payments/server-store'
import { createClient } from '@/lib/supabase/server'
import type { PaymentIntent } from '@/lib/payments/types'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params
    let intent = getServerIntent(id)

    // If not in in-memory store, attempt reading from persistent Supabase table
    if (!intent) {
      try {
        const supabase = await createClient()
        const { data: row, error } = await supabase
          .from('payment_intents')
          .select('*')
          .eq('id', id)
          .maybeSingle()

        if (!error && row) {
          intent = {
            id: row.id,
            network: row.network,
            status: row.status,
            conditions: {
              amount: {
                kind: row.amount_kind,
                asset: row.asset,
                amount: row.amount,
                amountMax: row.amount_max ?? undefined,
              },
              recipient: row.recipient,
              expiresAt: row.expires_at ?? undefined,
              reference: row.reference ?? undefined,
            },
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            onChainReference: row.reference ?? undefined,
          } as PaymentIntent
        }
      } catch (dbErr) {
        console.warn('[VeilPay] Supabase intent lookup error:', dbErr)
      }
    }

    if (!intent) {
      return NextResponse.json({ error: 'Payment intent not found' }, { status: 404 })
    }

    return NextResponse.json({ intent })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
