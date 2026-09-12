import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'

/**
 * Issues a stateless wallet-login challenge. The nonce is an HMAC of the
 * timestamp under the server secret, so /verify can validate it without
 * server-side storage. The client signs the full message with its wallet key.
 */
export async function POST() {
  const secret = process.env.SUPABASE_JWT_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Server is not configured for wallet authentication.' },
      { status: 503 },
    )
  }

  const timestamp = Math.floor(Date.now() / 1000)
  const nonce = createHmac('sha256', secret)
    .update(`veilpay-wallet-challenge:${timestamp}`)
    .digest('hex')
  const message = `VEILPAY-AUTH-v1\nveilpay.app\n${nonce}\n${timestamp}`

  return NextResponse.json({ nonce, timestamp, message })
}
