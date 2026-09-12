import type {
  AssetSymbol,
  AmountPredicateKind,
  PaymentConditions,
  PaymentIntent,
  PaymentIntentStatus,
} from './types'

export const SUPPORTED_ASSETS: AssetSymbol[] = ['tDUST', 'DUST', 'USDC']

export const AMOUNT_PREDICATES: { value: AmountPredicateKind; label: string }[] = [
  { value: 'exactly', label: 'Exactly' },
  { value: 'at_least', label: 'At least' },
  { value: 'range', label: 'Between' },
]

export interface ValidationIssue {
  field: string
  message: string
}

/**
 * State machine definition for authoritative server-side status transitions.
 * Terminal states (verified, expired, failed, cancelled) have no outgoing transitions.
 */
export const VALID_STATUS_TRANSITIONS: Record<PaymentIntentStatus, readonly PaymentIntentStatus[]> = {
  draft: ['awaiting_payment', 'cancelled'] as const,
  awaiting_payment: ['verifying', 'verified', 'expired', 'failed', 'cancelled'] as const,
  verifying: ['verified', 'failed'] as const,
  verified: [] as const,
  expired: [] as const,
  failed: [] as const,
  cancelled: [] as const,
  refunded: [] as const,
}

export function isValidStatusTransition(
  from: PaymentIntentStatus,
  to: PaymentIntentStatus,
): boolean {
  if (from === to) return true // Idempotent no-op
  const allowed = VALID_STATUS_TRANSITIONS[from]
  return Boolean(allowed && (allowed as readonly string[]).includes(to))
}

export function isTerminalStatus(status: PaymentIntentStatus): boolean {
  return VALID_STATUS_TRANSITIONS[status]?.length === 0
}

/**
 * Safe integer conversion to micro-units (6 decimal places = 1,000,000 micro-units).
 * Bypasses JavaScript floating point rounding errors entirely.
 */
export function parseDecimalToMicroUnits(val: string): bigint | null {
  const trimmed = val.trim()
  if (!/^\d{1,12}(\.\d{1,6})?$/.test(trimmed)) {
    return null
  }
  const [whole, frac = ''] = trimmed.split('.')
  const paddedFrac = frac.padEnd(6, '0').slice(0, 6)
  try {
    const wholeBig = BigInt(whole)
    const fracBig = BigInt(paddedFrac)
    return wholeBig * BigInt(1000000) + fracBig
  } catch {
    return null
  }
}

/** Check if an intent ID conforms to the strict format */
export function isValidIntentId(id: unknown): id is string {
  return typeof id === 'string' && /^pi_[a-zA-Z0-9_-]{8,64}$/.test(id.trim())
}

/**
 * Midnight addresses use Bech32m encoding with an `mn_` human-readable part:
 *   mn_addr1…, mn_shield-addr1…, mn_dust1…
 * Testnet/preprod variants insert the network id: mn_addr_preprod1…
 * The data part uses the Bech32 charset (excludes 1, b, i, o).
 * Legacy internal account identifiers (alphanumeric/underscore) are accepted
 * for backwards compatibility.
 */
const MIDNIGHT_BECH32M_ADDRESS =
  /^mn_(addr|shield-addr|dust)(_(preprod|test|dev))?1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{40,}$/i

/** Check if an address string is a valid Midnight or legacy account address */
export function isValidAddress(address: unknown): address is string {
  if (typeof address !== 'string') return false
  const trimmed = address.trim()
  if (MIDNIGHT_BECH32M_ADDRESS.test(trimmed)) {
    return trimmed.length <= 256
  }
  return (
    trimmed.length >= 8 &&
    trimmed.length <= 128 &&
    /^[a-zA-Z0-9_]+$/.test(trimmed)
  )
}

/**
 * Validate merchant-supplied conditions. Uses exact decimal parsing via BigInt
 * micro-units to eliminate float arithmetic vulnerabilities.
 */
export function validateConditions(conditions: PaymentConditions): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (!conditions || typeof conditions !== 'object') {
    issues.push({ field: 'conditions', message: 'Payment conditions object is required.' })
    return issues
  }

  // 1. Asset validation
  if (!conditions.amount?.asset || !SUPPORTED_ASSETS.includes(conditions.amount.asset)) {
    issues.push({
      field: 'asset',
      message: `Asset must be one of: ${SUPPORTED_ASSETS.join(', ')}.`,
    })
  }

  // 2. Kind validation
  const validKinds: AmountPredicateKind[] = ['exactly', 'at_least', 'range']
  if (!conditions.amount?.kind || !validKinds.includes(conditions.amount.kind)) {
    issues.push({
      field: 'kind',
      message: 'Amount condition kind must be "exactly", "at_least", or "range".',
    })
  }

  // 3. Amount decimal validation
  const rawAmount = conditions.amount?.amount ?? ''
  const amountMicro = parseDecimalToMicroUnits(rawAmount)

  if (!rawAmount.trim()) {
    issues.push({ field: 'amount', message: 'Amount is required.' })
  } else if (amountMicro === null || amountMicro <= BigInt(0)) {
    issues.push({
      field: 'amount',
      message: 'Amount must be a positive decimal number with at most 6 decimal places (e.g. 10.50).',
    })
  } else if (amountMicro > BigInt('100000000000000')) {
    // 100 million token limit
    issues.push({
      field: 'amount',
      message: 'Amount exceeds maximum allowable limit of 100,000,000 tokens.',
    })
  }

  // 4. Range validation
  if (conditions.amount?.kind === 'range') {
    const rawMax = conditions.amount.amountMax ?? ''
    const maxMicro = parseDecimalToMicroUnits(rawMax)

    if (!rawMax.trim()) {
      issues.push({ field: 'amountMax', message: 'Upper bound is required for a range.' })
    } else if (maxMicro === null || maxMicro <= BigInt(0)) {
      issues.push({
        field: 'amountMax',
        message: 'Upper bound must be a positive decimal number with at most 6 decimal places.',
      })
    } else if (amountMicro !== null && maxMicro <= amountMicro) {
      issues.push({
        field: 'amountMax',
        message: 'Upper bound must be strictly greater than the lower bound.',
      })
    } else if (maxMicro !== null && maxMicro > BigInt('100000000000000')) {
      issues.push({
        field: 'amountMax',
        message: 'Upper bound exceeds maximum allowable limit of 100,000,000 tokens.',
      })
    }
  }

  // 5. Recipient address validation
  if (!conditions.recipient || !conditions.recipient.trim()) {
    issues.push({ field: 'recipient', message: 'A recipient address is required.' })
  } else if (!isValidAddress(conditions.recipient)) {
    issues.push({
      field: 'recipient',
      message: 'Recipient must be a valid Midnight address (e.g. mn_addr1… or mn_shield-addr1…).',
    })
  }

  // 6. Expiration validation
  if (conditions.expiresAt) {
    const ts = Date.parse(conditions.expiresAt)
    if (Number.isNaN(ts)) {
      issues.push({ field: 'expiresAt', message: 'Expiry is not a valid ISO date.' })
    } else {
      const minFuture = Date.now() + 60 * 1000 // At least 60 seconds from now
      const maxFuture = Date.now() + 365 * 24 * 60 * 60 * 1000 // Max 1 year
      if (ts < minFuture) {
        issues.push({ field: 'expiresAt', message: 'Expiry must be at least 1 minute in the future.' })
      } else if (ts > maxFuture) {
        issues.push({ field: 'expiresAt', message: 'Expiry cannot exceed 1 year in the future.' })
      }
    }
  }

  // 7. Reference bounds
  if (conditions.reference) {
    const ref = conditions.reference.trim()
    if (ref.length > 100) {
      issues.push({ field: 'reference', message: 'Reference cannot exceed 100 characters.' })
    } else if (/[\x00-\x1F\x7F]/.test(ref)) {
      issues.push({ field: 'reference', message: 'Reference cannot contain control characters.' })
    }
  }

  return issues
}

/**
 * Assemble a typed, draft PaymentIntent from validated conditions.
 */
export function buildDraftIntent(
  conditions: PaymentConditions,
  options?: { id?: string; network?: string },
): PaymentIntent {
  return {
    id: options?.id ?? generateIntentId(),
    conditions,
    status: 'draft',
    createdAt: new Date().toISOString(),
    network: options?.network,
  }
}

/** Generate a secure client-side intent id using Web Crypto UUID */
export function generateIntentId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `pi_${crypto.randomUUID()}`
  }
  return `pi_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

export function describeAmountCondition(conditions: PaymentConditions): string {
  const { kind, amount, amountMax, asset } = conditions.amount
  if (kind === 'exactly') return `Exactly ${amount || '—'} ${asset}`
  if (kind === 'at_least') return `At least ${amount || '—'} ${asset}`
  return `Between ${amount || '—'} and ${amountMax || '—'} ${asset}`
}
