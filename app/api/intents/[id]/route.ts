import { NextResponse } from 'next/server'
import { getServerIntent } from '@/lib/payments/server-store'
import { createClient } from '@/lib/supabase/server'
import type { PaymentIntent, PaymentIntentStatus } from '@/lib/payments/types'
import { isValidIntentId } from '@/lib/payments/intent'
import {
  getVeilPayAPI,
  getVeilPayReadiness,
  getChainIntent,
  mapChainStatusToAppStatus,
} from '@/lib/veilpay-server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params

    if (!isValidIntentId(id)) {
      return NextResponse.json(
        { error: 'Invalid payment intent ID format' },
        { status: 400 },
      )
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // 1. Check persistent Supabase store first
    const { data: row, error } = await supabase
      .from('payment_intents')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    let intent: PaymentIntent | null = null

    if (!error && row) {
      // Check for merchant dashboard IDOR:
      // If requested from merchant dashboard context (/app) and belongs to a different merchant
      const referer = request.headers.get('referer') || ''
      const isMerchantContext = referer.includes('/app') || new URL(request.url).searchParams.get('scope') === 'merchant'

      if (isMerchantContext) {
        if (!user) {
          return NextResponse.json(
            { error: 'Unauthorized: Merchant authentication required' },
            { status: 401 },
          )
        }
        if (row.auth_user_id && row.auth_user_id !== user.id) {
          return NextResponse.json(
            { error: 'Forbidden: You do not have permission to view this merchant payment intent.' },
            { status: 403 },
          )
        }
      }

      // Check auto-expiration
      let status = row.status as PaymentIntentStatus
      if (
        row.expires_at &&
        new Date(row.expires_at).getTime() <= Date.now() &&
        ['draft', 'open', 'awaiting_payment'].includes(status)
      ) {
        status = 'expired'
        // Asynchronously update status in DB
        await supabase
          .from('payment_intents')
          .update({ status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', id)
      }

      const meta = (row.metadata ?? {}) as {
        chainIntentId?: string
        paymentSecret?: string
        expiresAtOps?: string
      }

      // Chain-backed intents: the contract ledger is authoritative. Sync the
      // local status from the on-chain state when the protocol stack is ready.
      if (meta.chainIntentId && getVeilPayReadiness().ready) {
        try {
          const api = await getVeilPayAPI()
          const chainIntent = await getChainIntent(api, meta.chainIntentId)
          if (chainIntent) {
            const chainStatus = mapChainStatusToAppStatus(chainIntent.status) as PaymentIntentStatus
            if (chainStatus !== status) {
              status = chainStatus
              await supabase
                .from('payment_intents')
                .update({ status: chainStatus, updated_at: new Date().toISOString() })
                .eq('id', id)
            }
          }
        } catch (chainErr) {
          console.error('[VeilPay] Chain status sync failed:', chainErr)
        }
      }

      intent = {
        id: row.id,
        network: row.network,
        status,
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
        chainIntentId: meta.chainIntentId,
        paymentSecret: meta.paymentSecret,
        expiresAtOps: meta.expiresAtOps,
      }
    } else {
      // Fallback to local server store
      const memIntent = getServerIntent(id)
      if (memIntent) {
        intent = memIntent
      }
    }

    if (!intent) {
      return NextResponse.json({ error: 'Payment intent not found in protocol registry' }, { status: 404 })
    }

    return NextResponse.json({ intent })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
