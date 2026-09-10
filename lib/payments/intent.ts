import type {
  AssetSymbol,
  AmountPredicateKind,
  PaymentConditions,
  PaymentIntent,
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
 * Validate merchant-supplied conditions. This is pure, synchronous, and free of
 * any network/chain dependency, so it runs safely on the client while building
 * an intent. It never guesses values — empty required fields are errors.
 */
export function validateConditions(conditions: PaymentConditions): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  const amount = Number(conditions.amount.amount)
  if (!conditions.amount.amount.trim()) {
    issues.push({ field: 'amount', message: 'Amount is required.' })
  } else if (!Number.isFinite(amount) || amount <= 0) {
    issues.push({ field: 'amount', message: 'Amount must be a positive number.' })
  }

  if (conditions.amount.kind === 'range') {
    const max = Number(conditions.amount.amountMax ?? '')
    if (!conditions.amount.amountMax?.trim()) {
      issues.push({ field: 'amountMax', message: 'Upper bound is required for a range.' })
    } else if (!Number.isFinite(max) || max <= amount) {
      issues.push({
        field: 'amountMax',
        message: 'Upper bound must be greater than the lower bound.',
      })
    }
  }

  if (!conditions.recipient.trim()) {
    issues.push({ field: 'recipient', message: 'A recipient address is required.' })
  }

  if (conditions.expiresAt) {
    const ts = Date.parse(conditions.expiresAt)
    if (Number.isNaN(ts)) {
      issues.push({ field: 'expiresAt', message: 'Expiry is not a valid date.' })
    } else if (ts <= Date.now()) {
      issues.push({ field: 'expiresAt', message: 'Expiry must be in the future.' })
    }
  }

  return issues
}

/**
 * Assemble a typed, draft PaymentIntent from validated conditions. This is the
 * exact payload shape that will be handed to the Midnight client once the
 * proving layer is wired — no chain call happens here.
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

/** Generate a client-side intent id. Uses the Web Crypto UUID where available. */
export function generateIntentId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `pi_${crypto.randomUUID()}`
  }
  return `pi_${Date.now().toString(36)}`
}

export function describeAmountCondition(conditions: PaymentConditions): string {
  const { kind, amount, amountMax, asset } = conditions.amount
  if (kind === 'exactly') return `Exactly ${amount || '—'} ${asset}`
  if (kind === 'at_least') return `At least ${amount || '—'} ${asset}`
  return `Between ${amount || '—'} and ${amountMax || '—'} ${asset}`
}
