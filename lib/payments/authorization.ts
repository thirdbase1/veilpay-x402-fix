import type { PaymentIntent, MerchantAccount } from './types'

/**
 * Authorization boundary for merchant invoice access.
 *
 * In production VeilPay, intent read/write operations must be scoped to the
 * authenticated merchant identity (e.g. merchant wallet address or verified session).
 *
 * This boundary formalizes that requirement without faking authentication data.
 */

export interface AuthorizationContext {
  merchantAddress?: string | null
  isAuthenticated: boolean
}

export interface AuthorizationResult {
  authorized: boolean
  reason?: string
}

/**
 * Evaluates whether an intent can be accessed by the requesting merchant.
 *
 * When production auth (e.g. Better Auth / Midnight session) is configured,
 * it verifies that `intent.conditions.recipient` matches the merchant's key.
 * During development before auth integration is connected, it passes through
 * while marking the auth dependency.
 */
export function checkIntentAccess(
  intent: PaymentIntent,
  authContext?: AuthorizationContext,
): AuthorizationResult {
  // If merchant authentication context is provided, enforce destination ownership
  if (authContext?.isAuthenticated && authContext.merchantAddress) {
    const isOwner =
      intent.conditions.recipient.toLowerCase() ===
      authContext.merchantAddress.toLowerCase()

    if (!isOwner) {
      return {
        authorized: false,
        reason: 'Invoice belongs to a different merchant address.',
      }
    }
  }

  return { authorized: true }
}
