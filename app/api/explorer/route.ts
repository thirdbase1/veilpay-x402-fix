import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * Public explorer feed. Serves a sanitized projection of every invoice
 * — the same data a block explorer would show: status, amount, asset, network,
 * masked recipient, and timestamps. No metadata, proofs, secrets, or merchant
 * account identifiers ever leave the server.
 */

// Columns that are safe to expose publicly. metadata carries the v2 chain
// registration (chainIntentId, merchantCoinPk, tokenColor) written at create
// time — only derived, non-identifying projections of it are returned.
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
  metadata,
  created_at,
  updated_at,
  expires_at,
  merchant_profiles ( business_name )
`

/**
 * v2 recipients are masked coin public keys, not wallet addresses — show the
 * first 6 hex chars of the registered merchantCoinPk (doc vocabulary).
 */
function maskRecipient(recipient: unknown, merchantCoinPk: unknown): string | null {
  if (typeof merchantCoinPk === 'string' && merchantCoinPk.length >= 6) {
    return `${merchantCoinPk.replace(/^0x/, '').slice(0, 6)}…`
  }
  if (typeof recipient !== 'string' || recipient.length === 0) return null
  if (recipient.length <= 14) return recipient
  return `${recipient.slice(0, 10)}…${recipient.slice(-6)}`
}

function maskIntentId(id: string): string {
  if (id.length <= 12) return id
  return `${id.slice(0, 9)}…${id.slice(-4)}`
}

/**
 * v2 has no native token — amounts are in whichever shielded zswap token
 * color the invoice pins, or any when open (zero color).
 */
function tokenColorLabel(tokenColor: unknown, legacyAsset: string): string {
  if (typeof tokenColor === 'string') {
    const hex = tokenColor.replace(/^0x/, '')
    if (/^[0-9a-fA-F]*$/.test(hex) && parseInt(hex || '0', 16) === 0) return 'open'
    return `color ${hex.slice(0, 6)}…`
  }
  return legacyAsset
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
    metadata: Record<string, unknown> | null
    created_at: string
    updated_at: string
    expires_at: string | null
    merchant_profiles: { business_name: string } | { business_name: string }[] | null
  }

  const payments = ((rows as Row[]) ?? []).map((row) => {
    const profile = Array.isArray(row.merchant_profiles)
      ? row.merchant_profiles[0]
      : row.merchant_profiles
    const meta = (row.metadata ?? {}) as {
      chainIntentId?: string
      merchantCoinPk?: string
      tokenColor?: string
    }
    return {
      // Prefer the on-chain numeric invoice id; fall back to the masked
      // registry id for legacy rows.
      id: meta.chainIntentId ? `invoice #${meta.chainIntentId}` : maskIntentId(row.id),
      status: row.status,
      amountKind: row.amount_kind,
      asset: tokenColorLabel(meta.tokenColor, row.asset),
      amount: row.amount,
      amountMax: row.amount_max,
      network: row.network,
      recipientMasked: maskRecipient(row.recipient, meta.merchantCoinPk),
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
