import type { PaymentIntent, VerificationResult } from '@/lib/payments/types'

/**
 * Typed boundary for the Midnight-backed VeilPay protocol.
 *
 * This interface is the single seam through which the application talks to the
 * privacy-preserving contract. Implementations belong on the server (they will
 * hold RPC endpoints, proving keys, and contract references that must never
 * reach the browser). The UI depends only on this interface.
 */
export interface MidnightClient {
  /** Whether a real, configured implementation is available. */
  readonly ready: boolean

  /**
   * Register a payment intent with the protocol, returning the intent updated
   * to `awaiting_payment` with any network-assigned metadata.
   */
  createIntent(intent: PaymentIntent): Promise<PaymentIntent>

  /** Fetch the current status of a previously created intent. */
  getIntent(intentId: string): Promise<PaymentIntent>

  /**
   * Verify that a payment satisfies the intent's conditions. Returns only the
   * minimal, privacy-preserving result — never payer identity or history.
   */
  verify(intentId: string): Promise<VerificationResult>
}

export class MidnightNotConfiguredError extends Error {
  constructor(operation: string) {
    super(
      `VeilPay Midnight integration is not configured. "${operation}" is unavailable until a MidnightClient implementation is wired to a deployed contract.`,
    )
    this.name = 'MidnightNotConfiguredError'
  }
}

/**
 * Safe default used until the real Midnight integration is implemented.
 *
 * It never fabricates transactions, statuses, or proofs. Every operation throws
 * a clear, typed error so callers can render an honest "integration pending"
 * state instead of fake data.
 */
export class NotImplementedMidnightClient implements MidnightClient {
  readonly ready = false

  createIntent(): Promise<PaymentIntent> {
    return Promise.reject(new MidnightNotConfiguredError('createIntent'))
  }

  getIntent(): Promise<PaymentIntent> {
    return Promise.reject(new MidnightNotConfiguredError('getIntent'))
  }

  verify(): Promise<VerificationResult> {
    return Promise.reject(new MidnightNotConfiguredError('verify'))
  }
}

/**
 * Resolve the active MidnightClient. Returns the not-implemented client until a
 * concrete implementation is registered. Kept intentionally simple so a real
 * implementation can be swapped in one place.
 */
export function getMidnightClient(): MidnightClient {
  return new NotImplementedMidnightClient()
}
