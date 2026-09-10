/**
 * VeilPay payment domain model.
 *
 * These types are the stable contract between the merchant UI, the SDK, and the
 * eventual Midnight contract integration. They deliberately describe *what* a
 * merchant wants verified, not *how* Midnight proves it — so the same shapes
 * survive once the real proving/verification layer is wired in.
 */

/** Assets a payment can be denominated in. Expand as the protocol supports more. */
export type AssetSymbol = 'DUST' | 'tDUST' | 'USDC'

/** How a numeric payment condition is compared against the payment. */
export type AmountPredicateKind = 'exactly' | 'at_least' | 'range'

export interface AmountCondition {
  kind: AmountPredicateKind
  asset: AssetSymbol
  /** Human-entered decimal amount, kept as a string to avoid float rounding. */
  amount: string
  /** Upper bound, only used when `kind === 'range'`. */
  amountMax?: string
}

export interface PaymentConditions {
  amount: AmountCondition
  /** The address that must receive the payment (merchant-controlled). */
  recipient: string
  /** ISO-8601 expiry after which the intent can no longer be satisfied. */
  expiresAt?: string
  /**
   * Opaque reference the merchant reconciles against (order id, invoice no.).
   * Never a secret — treat as a public correlation handle.
   */
  reference?: string
}

/** Alias for PaymentConditions for protocol-level requirement descriptors. */
export type PaymentRequirement = PaymentConditions

/**
 * Allowed statuses supported by the actual protocol/application state:
 * - draft: Defined locally, not yet active or broadcast
 * - awaiting_payment: Active, published, waiting for customer payment
 * - verifying: Payment transaction detected, zero-knowledge proof verification underway
 * - verified: Payment satisfied all intent conditions
 * - expired: Intent deadline elapsed before payment satisfied
 * - failed: Verification or execution failed
 * - cancelled: Merchant cancelled intent prior to settlement
 */
export type PaymentIntentStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'verifying'
  | 'verified'
  | 'expired'
  | 'failed'
  | 'cancelled'

export interface PaymentIntent {
  /** Stable identifier for the intent (e.g. pi_...). */
  id: string
  conditions: PaymentConditions
  status: PaymentIntentStatus
  createdAt: string
  updatedAt?: string
  /** Network the intent targets, echoed from configuration. */
  network?: string
  /** Optional transaction hash or on-chain registration reference once submitted to Midnight. */
  onChainReference?: string
}

/**
 * Result returned by the verification layer. It answers the only question a
 * merchant needs — did the payment satisfy the conditions — plus the minimal
 * metadata required for reconciliation. It intentionally carries no payer
 * identity, balance, or history.
 */
export interface VerificationResult {
  intentId: string
  satisfied: boolean
  status: Extract<PaymentIntentStatus, 'verified' | 'failed' | 'expired'>
  /** Opaque proof reference produced by the protocol, if available. */
  proofReference?: string
  verifiedAt?: string
}

export type PaymentVerification = VerificationResult

export interface MerchantAccount {
  address: string
  network: string
  label?: string
}

export interface DashboardMetrics {
  activeCount: number
  verifiedCount: number
  pendingCount: number
  expiredCount: number
  totalCount: number
}

export interface CreatePaymentIntentInput {
  conditions: PaymentConditions
  publishOnMidnight?: boolean
}
