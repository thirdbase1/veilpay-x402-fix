import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Public explorer feed. Serves a sanitized projection of every payment intent
 * — the same data a block explorer would show: status, amount, asset, network,
 * masked recipient, and timestamps. No metadata, proofs, secrets, or merchant
 * account identifiers ever leave the server.
 */

// Columns that are safe to expose publicly.
const PUBLIC_COLUMNS = `
  id,
  status,
  amount_kind,
  asset,
  amount,
  amount_max,
  network,
  recipient,
  reference,
  created_at,
  updated_at,
  expires_at,
  merchant_profiles ( business_name )
`

function maskRecipient(recipient: unknown): string | null {
  if (typeof recipient !== 'string' || recipient.length === 0) return null
  if (recipient.length <= 14) return recipient
  return `${recipient.slice(0, 10)}…${recipient.slice(-6)}`
}

function maskIntentId(id: string): string {
  if (id.length <= 12) return id
  return `${id.slice(0, 9)}…${id.slice(-4)}`
}

export async function GET() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'Explorer data source is not configured.' },
      { status: 503 },
    )
  }

  // Service-role client: the explorer is public and read-only, but the
  // underlying table is RLS-protected for merchant privacy. Only the
  // sanitized projection below is ever returned.
  const admin = createSupabaseClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const now = Date.now()

  // Lazy expiry sweep: transition stale active intents so the explorer
  // (and merchant dashboards) reflect reality without a cron job.
  const { data: staleRows } = await admin
    .from('payment_intents')
    .select('id, expires_at, status')
    .in('status', ['awaiting_payment', 'verifying', 'draft'])
    .not('expires_at', 'is', null)
    .lt('expires_at', new Date(now).toISOString())
    .limit(100)

  if (staleRows && staleRows.length > 0) {
    await admin
      .from('payment_intents')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .in(
        'id',
        staleRows.map((r) => r.id),
      )
  }

  const { data: rows, error } = await admin
    .from('payment_intents')
    .select(PUBLIC_COLUMNS)
    .neq('status', 'draft')
    .order('updated_at', { ascending: false, nullsFirst: false })
    .limit(60)

  if (error) {
    return NextResponse.json(
      { error: 'Failed to load explorer data.' },
      { status: 500 },
    )
  }

  type Row = {
    id: string
    status: string
    amount_kind: string
    asset: string
    amount: string
    amount_max: string | null
    network: string
    recipient: string
    reference: string | null
    created_at: string
    updated_at: string
    expires_at: string | null
    merchant_profiles: { business_name: string } | { business_name: string }[] | null
  }

  const payments = ((rows as Row[]) ?? []).map((row) => {
    const profile = Array.isArray(row.merchant_profiles)
      ? row.merchant_profiles[0]
      : row.merchant_profiles
    return {
      id: maskIntentId(row.id),
      status: row.status,
      amountKind: row.amount_kind,
      asset: row.asset,
      amount: row.amount,
      amountMax: row.amount_max,
      network: row.network,
      recipientMasked: maskRecipient(row.recipient),
      reference: row.reference,
      merchantName: profile?.business_name ?? 'Unregistered merchant',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      expiresAt: row.expires_at,
    }
  })

  const verified = payments.filter((p) => p.status === 'verified')
  const settledVolume = verified.reduce((sum, p) => {
    const value = Number.parseFloat(p.amount)
    return Number.isFinite(value) ? sum + value : sum
  }, 0)

  return NextResponse.json(
    {
      payments,
      stats: {
        total: payments.length,
        verified: verified.length,
        awaiting: payments.filter((p) => p.status === 'awaiting_payment').length,
        expired: payments.filter((p) => p.status === 'expired').length,
        settledVolume: Number(settledVolume.toFixed(2)),
      },
      generatedAt: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
