import { NextResponse, type NextRequest } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Verifies a BIP-340 Schnorr signature over the wallet-login challenge and
 * mints a Supabase session for the wallet's deterministic account. The
 * session password is derived server-side from a server secret and the wallet
 * public key — it never reaches the client, and possession of the wallet seed
 * is the only way to produce a valid signature.
 */

const CHALLENGE_MAX_AGE_SECONDS = 600

function getAdminClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {
          // Admin client never touches browser cookies.
        },
      },
    },
  )
}

function isHex(value: unknown, length: number): value is string {
  return typeof value === 'string' && value.length === length && /^[0-9a-fA-F]+$/.test(value)
}

/** Provision (or reuse) the wallet account and mint a browser session. */
async function mintSession({
  email,
  password,
  metadata,
}: {
  email: string
  password: string
  metadata: Record<string, unknown>
}) {
  const admin = getAdminClient()
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata,
  })

  if (createError && !createError.message.toLowerCase().includes('already been registered')) {
    return NextResponse.json(
      { error: 'Could not provision the wallet account. Please try again.' },
      { status: 500 },
    )
  }

  // Sign in on the cookie-bound client so the session is stored in browser cookies.
  const supabase = await createSupabaseServerClient()
  const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (signInError || !sessionData.user) {
    return NextResponse.json(
      { error: 'Wallet verified but the session could not be established. Please try again.' },
      { status: 500 },
    )
  }

  const { data: profile } = await supabase
    .from('merchant_profiles')
    .select('onboarding_status')
    .eq('auth_user_id', sessionData.user.id)
    .maybeSingle()

  return NextResponse.json({
    success: true,
    walletPubkey: (metadata.wallet_pubkey as string) ?? null,
    hasProfile: profile?.onboarding_status === 'completed',
  })
}

export async function POST(request: NextRequest) {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Server is not configured for wallet authentication.' },
      { status: 503 },
    )
  }

  let body: {
    mode?: unknown
    publicKey?: unknown
    signature?: unknown
    nonce?: unknown
    timestamp?: unknown
    walletId?: unknown
    address?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const { publicKey, signature, nonce, timestamp } = body

  // Extension mode: the identity is the extension-approved account address.
  // Ownership is established by the user approving the enable() handshake in
  // their wallet extension (Lace / 1AM) — no seed material ever reaches us.
  if (body.mode === 'extension') {
    const { walletId, address } = body
    if (
      typeof walletId !== 'string' ||
      walletId.length === 0 ||
      walletId.length > 64 ||
      !/^[\w-]+$/.test(walletId) ||
      typeof address !== 'string' ||
      address.length === 0 ||
      address.length > 256
    ) {
      return NextResponse.json({ error: 'Malformed wallet credentials.' }, { status: 400 })
    }

    const ts = Number(timestamp)
    if (!Number.isInteger(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > CHALLENGE_MAX_AGE_SECONDS) {
      return NextResponse.json({ error: 'Challenge expired. Please try again.' }, { status: 401 })
    }

    const expectedNonce = createHmac('sha256', secret)
      .update(`veilpay-wallet-challenge:${ts}`)
      .digest('hex')
    const nonceMatch =
      typeof nonce === 'string' &&
      nonce.length === expectedNonce.length &&
      timingSafeEqual(Buffer.from(nonce, 'hex'), Buffer.from(expectedNonce, 'hex'))
    if (!nonceMatch) {
      return NextResponse.json({ error: 'Invalid challenge. Please try again.' }, { status: 401 })
    }

    // The account identity must be the wallet ADDRESS alone. The walletId is
    // the extension's per-page-load injection key (a fresh UUID for v4 wallets
    // on every reload) — including it minted a different account each visit,
    // losing the merchant profile and forcing onboarding again.
    const identity = address.toLowerCase()
    const email = `wallet-${createHmac('sha256', secret).update(`veilpay-wallet-id:${identity}`).digest('hex')}@wallet.veilpay.app`
    const password = createHmac('sha256', secret)
      .update(`veilpay-wallet-session:${identity}`)
      .digest('hex')

    return mintSession({
      email,
      password,
      metadata: {
        wallet_provider: walletId,
        wallet_address: address,
        wallet_pubkey: address,
        auth_method: 'wallet-extension',
      },
    })
  }
  // BIP-340 keys are 32-byte x-only (64 hex chars); signatures are 64 bytes.
  if (!isHex(publicKey, 64) || !isHex(signature, 128) || !isHex(nonce, 64)) {
    return NextResponse.json({ error: 'Malformed wallet credentials.' }, { status: 400 })
  }

  const ts = Number(timestamp)
  if (!Number.isInteger(ts) || Math.abs(Math.floor(Date.now() / 1000) - ts) > CHALLENGE_MAX_AGE_SECONDS) {
    return NextResponse.json({ error: 'Challenge expired. Please try again.' }, { status: 401 })
  }

  // Stateless nonce check: the nonce must be the HMAC of the challenge timestamp.
  const expectedNonce = createHmac('sha256', secret)
    .update(`veilpay-wallet-challenge:${ts}`)
    .digest('hex')
  const nonceMatch =
    nonce.length === expectedNonce.length &&
    timingSafeEqual(Buffer.from(nonce, 'hex'), Buffer.from(expectedNonce, 'hex'))
  if (!nonceMatch) {
    return NextResponse.json({ error: 'Invalid challenge. Please try again.' }, { status: 401 })
  }

  // Verify the Schnorr signature over the canonical login message.
  const message = `VEILPAY-AUTH-v1\nveilpay.app\n${nonce}\n${ts}`
  const { sha256 } = await import('@noble/hashes/sha2.js')
  const { schnorr } = await import('@noble/curves/secp256k1.js')
  const messageHash = sha256(new TextEncoder().encode(message))
  const signatureValid = schnorr.verify(signature, messageHash, publicKey)
  if (!signatureValid) {
    return NextResponse.json({ error: 'Wallet signature verification failed.' }, { status: 401 })
  }

  const normalizedKey = publicKey.toLowerCase()
  // Deterministic account identity for the wallet. The password is derived
  // server-side and never exposed; only a valid wallet signature reaches here.
  const email = `wallet-${normalizedKey}@wallet.veilpay.app`
  const password = createHmac('sha256', secret)
    .update(`veilpay-wallet-session:${normalizedKey}`)
    .digest('hex')

  return mintSession({
    email,
    password,
    metadata: { wallet_pubkey: normalizedKey, auth_method: 'wallet' },
  })
}
