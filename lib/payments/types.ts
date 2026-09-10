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

/** Lifecycle of a payment intent. Advanced only by the verification layer. */
export type PaymentIntentStatus =
  | 'draft'
  | 'awaiting_payment'
  | 'verifying'
  | 'verified'
  | 'expired'
  | 'failed'

export interface PaymentIntent {
  /** Stable client-generated identifier for the intent. */
  id: string
  conditions: PaymentConditions
  status: PaymentIntentStatus
  createdAt: string
  /** Network the intent targets, echoed from configuration. */
  network?: string
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
