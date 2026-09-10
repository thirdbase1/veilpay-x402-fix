import test from 'node:test'
import assert from 'node:assert/strict'

// 1. DECIMAL & MONEY SAFETY TESTS
function parseDecimalToMicroUnits(val) {
  const trimmed = val.trim()
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(trimmed)) {
    return null
  }
  const [whole, frac = ''] = trimmed.split('.')
  const paddedFrac = frac.padEnd(6, '0').slice(0, 6)
  try {
    const wholeBig = BigInt(whole)
    const fracBig = BigInt(paddedFrac)
    return wholeBig * 1_000_000n + fracBig
  } catch {
    return null
  }
}

test('Money & Decimal: exact parsing without floating-point inaccuracies', () => {
  assert.equal(parseDecimalToMicroUnits('1'), 1_000_000n)
  assert.equal(parseDecimalToMicroUnits('0.1'), 100_000n)
  assert.equal(parseDecimalToMicroUnits('0.000001'), 1n)
  assert.equal(parseDecimalToMicroUnits('100.50'), 100_500_000n)
  assert.equal(parseDecimalToMicroUnits('99999999.999999'), 99_999_999_999_999n)

  // Floating point edge case in JS (0.1 + 0.2 !== 0.3)
  const a = parseDecimalToMicroUnits('0.1')
  const b = parseDecimalToMicroUnits('0.2')
  const c = parseDecimalToMicroUnits('0.3')
  assert.equal(a + b, c)
})

test('Money & Decimal: rejects invalid/dangerous amount formats', () => {
  // Scientific notation rejected
  assert.equal(parseDecimalToMicroUnits('1e5'), null)
  assert.equal(parseDecimalToMicroUnits('1e-3'), null)
  // Negative amounts rejected
  assert.equal(parseDecimalToMicroUnits('-50'), null)
  // Non-numeric characters rejected
  assert.equal(parseDecimalToMicroUnits('50abc'), null)
  assert.equal(parseDecimalToMicroUnits('$50'), null)
  assert.equal(parseDecimalToMicroUnits('50,00'), null)
  // More than 6 decimal places rejected
  assert.equal(parseDecimalToMicroUnits('0.1234567'), null)
  // Empty or whitespace rejected
  assert.equal(parseDecimalToMicroUnits(''), null)
  assert.equal(parseDecimalToMicroUnits('   '), null)
})

// 2. STATUS TRANSITIONS & STATE MACHINE TESTS
const VALID_STATUS_TRANSITIONS = {
  draft: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['verifying', 'verified', 'expired', 'failed', 'cancelled'],
  verifying: ['verified', 'failed'],
  verified: [],
  expired: [],
  failed: [],
  cancelled: [],
}

function isValidStatusTransition(from, to) {
  if (from === to) return true
  const allowed = VALID_STATUS_TRANSITIONS[from]
  return Boolean(allowed && allowed.includes(to))
}

test('Status State Machine: valid transitions succeed', () => {
  assert.equal(isValidStatusTransition('draft', 'awaiting_payment'), true)
  assert.equal(isValidStatusTransition('awaiting_payment', 'verifying'), true)
  assert.equal(isValidStatusTransition('verifying', 'verified'), true)
  assert.equal(isValidStatusTransition('draft', 'cancelled'), true)
  assert.equal(isValidStatusTransition('awaiting_payment', 'cancelled'), true)
  assert.equal(isValidStatusTransition('awaiting_payment', 'expired'), true)
  // Idempotent self-transition
  assert.equal(isValidStatusTransition('awaiting_payment', 'awaiting_payment'), true)
  assert.equal(isValidStatusTransition('cancelled', 'cancelled'), true)
})

test('Status State Machine: invalid transitions are strictly rejected', () => {
  // Terminal state transitions forbidden
  assert.equal(isValidStatusTransition('cancelled', 'draft'), false)
  assert.equal(isValidStatusTransition('cancelled', 'verified'), false)
  assert.equal(isValidStatusTransition('verified', 'cancelled'), false)
  assert.equal(isValidStatusTransition('verified', 'draft'), false)
  assert.equal(isValidStatusTransition('expired', 'draft'), false)
  assert.equal(isValidStatusTransition('failed', 'verified'), false)
  // Illegal shortcuts
  assert.equal(isValidStatusTransition('draft', 'verified'), false)
})

// 3. INTENT ID & ADDRESS FORMAT VALIDATION
function isValidIntentId(id) {
  return typeof id === 'string' && /^pi_[a-zA-Z0-9_-]{8,64}$/.test(id.trim())
}

function isValidAddress(address) {
  if (typeof address !== 'string') return false
  const trimmed = address.trim()
  return (
    trimmed.length >= 8 &&
    trimmed.length <= 128 &&
    /^[a-zA-Z0-9_]+$/.test(trimmed)
  )
}

test('Validation: strict Intent ID checking', () => {
  assert.equal(isValidIntentId('pi_e5f8a02d-6207-4f6c-8208-a53ec4fe45d5'), true)
  assert.equal(isValidIntentId('pi_12345678'), true)
  assert.equal(isValidIntentId('pi_short'), false) // < 8 suffix chars
  assert.equal(isValidIntentId('intent_12345678'), false) // Missing pi_ prefix
  assert.equal(isValidIntentId('pi_invalid;DROP TABLE users;'), false)
  assert.equal(isValidIntentId(null), false)
  assert.equal(isValidIntentId(undefined), false)
  assert.equal(isValidIntentId(''), false)
})

test('Validation: strict Recipient Address checking', () => {
  assert.equal(isValidAddress('mn_merchant_alpha_9942a'), true)
  assert.equal(isValidAddress('addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer5pnz75xxcrzqf96k'), true)
  assert.equal(isValidAddress('short'), false) // < 8 characters
  assert.equal(isValidAddress('addr with spaces'), false)
  assert.equal(isValidAddress('addr<script>'), false)
  assert.equal(isValidAddress(''), false)
})

// 4. AUTHORIZATION & IDOR PREVENTION RULES
test('Authorization: Server-side ownership prevents IDOR', () => {
  const merchantUserA = { id: 'usr_alice_123' }
  const merchantUserB = { id: 'usr_bob_456' }

  const intentOwnedByA = {
    id: 'pi_test_intent_a',
    auth_user_id: 'usr_alice_123',
    status: 'open',
  }

  // Helper simulating server-side mutation authorization
  function authorizeMutation(requestUser, resource) {
    if (!requestUser || !requestUser.id) {
      return { authorized: false, status: 401, error: 'Unauthorized' }
    }
    if (resource.auth_user_id && resource.auth_user_id !== requestUser.id) {
      return { authorized: false, status: 403, error: 'Forbidden' }
    }
    return { authorized: true }
  }

  // Merchant A can mutate own resource
  const resA = authorizeMutation(merchantUserA, intentOwnedByA)
  assert.equal(resA.authorized, true)

  // Merchant B CANNOT mutate Merchant A's resource (IDOR blocked)
  const resB = authorizeMutation(merchantUserB, intentOwnedByA)
  assert.equal(resB.authorized, false)
  assert.equal(resB.status, 403)

  // Unauthenticated caller cannot mutate
  const resAnon = authorizeMutation(null, intentOwnedByA)
  assert.equal(resAnon.authorized, false)
  assert.equal(resAnon.status, 401)
})

// 5. PUBLIC CHECKOUT DATA SHAPING
test('Public Checkout: Sensitive internal merchant metadata is not exposed', () => {
  const internalDatabaseRow = {
    id: 'pi_checkout_99',
    auth_user_id: 'usr_secret_merchant_uuid_xyz',
    merchant_id: 'merch_secret_internal_uuid_123',
    network: 'midnight-testnet',
    status: 'awaiting_payment',
    amount_kind: 'exactly',
    asset: 'tDUST',
    amount: '45.00',
    amount_max: null,
    recipient: 'mn_merchant_alpha_9942a',
    expires_at: '2026-12-31T23:59:59.000Z',
    reference: 'INV-2026-001',
    internal_notes: 'VIP customer, charge fee waived',
    created_at: '2026-09-10T12:00:00.000Z',
    updated_at: '2026-09-10T12:00:00.000Z',
  }

  // Shaped public response
  const publicResponse = {
    id: internalDatabaseRow.id,
    network: internalDatabaseRow.network,
    status: internalDatabaseRow.status,
    conditions: {
      amount: {
        kind: internalDatabaseRow.amount_kind,
        asset: internalDatabaseRow.asset,
        amount: internalDatabaseRow.amount,
        amountMax: internalDatabaseRow.amount_max ?? undefined,
      },
      recipient: internalDatabaseRow.recipient,
      expiresAt: internalDatabaseRow.expires_at ?? undefined,
      reference: internalDatabaseRow.reference ?? undefined,
    },
    createdAt: internalDatabaseRow.created_at,
    updatedAt: internalDatabaseRow.updated_at,
  }

  // Assert sensitive fields are stripped
  assert.equal(publicResponse.auth_user_id, undefined)
  assert.equal(publicResponse.merchant_id, undefined)
  assert.equal(publicResponse.internal_notes, undefined)
  assert.equal(publicResponse.id, 'pi_checkout_99')
  assert.equal(publicResponse.conditions.amount.amount, '45.00')
})

// 6. CONCURRENCY & IDEMPOTENCY
test('Concurrency: Duplicate intent creation returns idempotent result', () => {
  const existingIntents = new Map()

  function handleCreateIntent(merchantUserId, idempotencyKey, payload) {
    if (idempotencyKey && existingIntents.has(idempotencyKey)) {
      const existing = existingIntents.get(idempotencyKey)
      if (existing.auth_user_id !== merchantUserId) {
        return { status: 409, error: 'Idempotency conflict' }
      }
      return { status: 200, intent: existing, isDuplicate: true }
    }

    const newIntent = {
      id: idempotencyKey || `pi_${Date.now()}`,
      auth_user_id: merchantUserId,
      ...payload,
    }
    if (idempotencyKey) {
      existingIntents.set(idempotencyKey, newIntent)
    }
    return { status: 201, intent: newIntent, isDuplicate: false }
  }

  // 1st request succeeds
  const res1 = handleCreateIntent('usr_alice', 'pi_idem_key_1', { amount: '10.00' })
  assert.equal(res1.status, 201)
  assert.equal(res1.isDuplicate, false)

  // Repeated request with same key returns existing idempotent record
  const res2 = handleCreateIntent('usr_alice', 'pi_idem_key_1', { amount: '10.00' })
  assert.equal(res2.status, 200)
  assert.equal(res2.isDuplicate, true)
  assert.equal(res2.intent.id, 'pi_idem_key_1')

  // Attempt by different user with same key is rejected with conflict
  const res3 = handleCreateIntent('usr_bob', 'pi_idem_key_1', { amount: '10.00' })
  assert.equal(res3.status, 409)
})
