'use client'

/**
 * Customer payment execution through an injected Midnight wallet, following
 * the official dApp-connector API (docs.midnight.network/api-reference/dapp-connector):
 *
 *   const connected = await provider.connect()            // or enable() on older Lace
 *   const { tx } = await connected.makeTransfer([{ ... }]) // wallet prompts approval
 *   await connected.submitTransaction(tx)
 *
 * Wallet discovery must not hardcode injection keys — newer extensions
 * register under dynamic UUID keys — so providers are resolved through the
 * shared detector, which enumerates every window.midnight entry.
 */

import { detectInjectedWallets, connectWalletApi, type WalletProviderId } from './detect'
import type { AssetSymbol } from '@/lib/payments/types'

/** Native DUST token type serialization (ledger v4 `nativeToken()` output). */
const NATIVE_TOKEN_HEX =
  '02000000000000000000000000000000000000000000000000000000000000000000'

/** All supported assets use 6 base units (micro-tokens). */
const DECIMALS = 6

interface TransferOutput {
  kind: 'unshielded' | 'shielded'
  tokenType: string
  value: bigint | number | string
  recipient: string
}

interface WalletConnectedApi {
  makeTransfer?: (outputs: TransferOutput[], options?: { payFees?: boolean }) => Promise<{ tx?: string } | string>
  submitTransaction?: (tx: string) => Promise<void>
  getShieldedAddresses?: () => Promise<{ shieldedAddress?: string }>
  getUnshieldedAddress?: () => Promise<string>
}

/** Convert a human decimal amount ("25.50") into 6-decimal base units. */
export function toBaseUnits(amount: string): bigint {
  const trimmed = amount.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error(`Invalid payment amount: "${amount}"`)
  }
  const [whole, frac = ''] = trimmed.split('.')
  const fracPadded = (frac + '0'.repeat(DECIMALS)).slice(0, DECIMALS)
  return BigInt(`${whole}${fracPadded}`)
}

/** Resolve the on-chain token type for a supported asset symbol. */
export function tokenTypeForAsset(asset: AssetSymbol): string {
  if (asset === 'DUST' || asset === 'tDUST') return NATIVE_TOKEN_HEX
  // USDC is an issued token — its type depends on the issuing contract and
  // cannot be derived client-side. Fail honestly rather than sending a wrong
  // token type to the wallet.
  throw new Error(
    'USDC payments require the issuer token type, which is not configured for this network. Use DUST or tDUST.',
  )
}

/**
 * Execute the intent payment inside the customer's wallet extension:
 * the wallet pops its approval dialog showing the exact token amount and
 * recipient, then broadcasts the transfer. Returns the submitted transaction
 * reference for server-side verification.
 */
export async function payIntentWithWallet(options: {
  /** Detected wallet to use; defaults to the first available provider. */
  providerId?: WalletProviderId
  recipient: string
  amount: string
  asset: AssetSymbol
  /** Called once the wallet approval dialog is up. */
  onAwaitingApproval?: () => void
}): Promise<{ txReference: string }> {
  const { recipient, amount, asset, onAwaitingApproval } = options

  const wallets = detectInjectedWallets()
  if (wallets.length === 0) {
    throw new Error(
      'No Midnight wallet extension detected. Install Lace or the 1AM wallet, then reload this page.',
    )
  }
  const providerId = options.providerId ?? wallets[0].id

  // connect()/enable() — the extension asks the user to approve the session.
  const { api } = await connectWalletApi(providerId)
  const connectedApi = api as WalletConnectedApi

  if (
    typeof connectedApi?.makeTransfer !== 'function' ||
    typeof connectedApi?.submitTransaction !== 'function'
  ) {
    throw new Error(
      'The connected wallet does not expose the payment API (makeTransfer/submitTransaction). Update the extension and try again.',
    )
  }

  const tokenType = tokenTypeForAsset(asset)
  const value = toBaseUnits(amount)

  onAwaitingApproval?.()

  // The wallet shows its native approval UI with the exact amount + recipient.
  const result = await connectedApi.makeTransfer([
    { kind: 'unshielded', tokenType, value, recipient },
  ])

  const tx = typeof result === 'string' ? result : result?.tx
  if (!tx) {
    throw new Error('The wallet did not return a transaction to submit.')
  }

  await connectedApi.submitTransaction(tx)

  // submitTransaction() resolves void; use a short digest of the tx payload
  // as the correlation reference for server-side verification.
  const txReference = `tx_${Array.from(tx.slice(0, 40))
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join('')}`

  return { txReference }
}
