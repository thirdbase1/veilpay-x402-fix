/**
 * Server-only VeilPay protocol integration.
 *
 * Follows vendor/veilpay/docs/WEBSITE-INTEGRATION.md:
 *  - All contract interaction happens server-side; the browser never holds keys.
 *  - The gateway stack authenticates to the preprod indexer with the merchant
 *    seed (VEILPAY_SEED) and caches its session in cli/.veilpay-state/.
 *  - The compiled contract artifacts (contract/src/managed/) are produced by
 *    the veilpay repo CI ("veilpay-managed" artifact) and must be present for
 *    the API module to load.
 *
 * The vendored workspaces are loaded through a runtime dynamic import so the
 * Next.js bundler never tries to inline the midnight-js / polkadot dependency
 * tree; they resolve their own node_modules from vendor/veilpay at runtime.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Deployed VeilPay contract on Midnight preprod (from the repo README). */
export const VEILPAY_CONTRACT_ADDRESS =
  process.env.VEILPAY_CONTRACT_ADDRESS?.trim() ||
  '0x304666ce3bb47edab2267a88eb650330042e1d6b1bea347d8f391b3fd09d719f'

export const VEILPAY_NETWORK = 'preprod'

const VENDOR_ROOT = join(process.cwd(), 'vendor', 'veilpay')
const MANAGED_ARTIFACT = join(
  VENDOR_ROOT,
  'contract',
  'src',
  'managed',
  'veilpay',
  'contract',
  'index.js',
)

export interface VeilPayReadiness {
  ready: boolean
  network: string
  contractAddress: string
  seedConfigured: boolean
  artifactsPresent: boolean
  missing: string[]
}

export function getVeilPayReadiness(): VeilPayReadiness {
  const seedConfigured = Boolean(process.env.VEILPAY_SEED?.trim())
  const artifactsPresent = existsSync(MANAGED_ARTIFACT)

  const missing: string[] = []
  if (!seedConfigured) {
    missing.push('VEILPAY_SEED: merchant wallet seed phrase used to authenticate the gateway session')
  }
  if (!artifactsPresent) {
    missing.push(
      'Compiled contract artifacts: extract the "veilpay-managed" CI artifact into vendor/veilpay/contract/src/managed/',
    )
  }

  return {
    ready: missing.length === 0,
    network: VEILPAY_NETWORK,
    contractAddress: VEILPAY_CONTRACT_ADDRESS,
    seedConfigured,
    artifactsPresent,
    missing,
  }
}

export class VeilPayUnavailableError extends Error {
  readonly missing: string[]
  constructor(missing: string[]) {
    super(
      `VeilPay protocol integration is not ready. Missing: ${missing.join('; ')}`,
    )
    this.name = 'VeilPayUnavailableError'
    this.missing = missing
  }
}

/** Minimal structural types for the vendored API surface we use. */
export interface VeilPayApi {
  deployedContractAddress: { address: string }
  providers: unknown
  createIntent(amount: bigint, expiresAt: number, paymentSecret: Uint8Array): Promise<bigint>
  pay(intentId: bigint, paymentSecret: Uint8Array): Promise<unknown>
  refund(intentId: bigint, amount: bigint): Promise<unknown>
  cancel(intentId: bigint): Promise<unknown>
  isPaid(intentId: bigint): Promise<boolean>
}

interface VeilPayLedgerIntent {
  merchantId: unknown
  amount: unknown
  expiresAt: unknown
  status: unknown
  paidAmount: unknown
  refundedAmount: unknown
}

export type VeilPayChainStatus = 'ACTIVE' | 'PAID' | 'REFUNDED' | 'CANCELLED'

export interface VeilPayChainIntent {
  id: string
  status: VeilPayChainStatus
  amount: string
  paidAmount: string
  refundedAmount: string
  expiresAtOps: string
}

function dynamicImport(specifier: string): Promise<unknown> {
  // Escape the bundler: the vendored ESM workspaces must resolve their own
  // dependencies at runtime, not be inlined by Turbopack/webpack.
  const runtimeImport = new Function('specifier', 'return import(specifier)') as (
    s: string,
  ) => Promise<unknown>
  return runtimeImport(specifier)
}

declare global {
  // eslint-disable-next-line no-var
  var __veilpay_api_promise__: Promise<VeilPayApi> | undefined
}

async function buildVeilPayApi(): Promise<VeilPayApi> {
  const readiness = getVeilPayReadiness()
  if (!readiness.ready) {
    throw new VeilPayUnavailableError(readiness.missing)
  }

  const apiUrl = pathToFileURL(join(VENDOR_ROOT, 'api', 'src', 'index.js')).href
  const stackUrl = pathToFileURL(join(VENDOR_ROOT, 'cli', 'src', 'gateway-stack.js')).href

  const [{ VeilPayAPI }, { buildGatewayStack }] = (await Promise.all([
    dynamicImport(apiUrl),
    dynamicImport(stackUrl),
  ])) as [
    { VeilPayAPI: { join(providers: unknown, address: string): Promise<VeilPayApi> } },
    { buildGatewayStack: () => Promise<unknown> },
  ]

  const providers = await buildGatewayStack()
  return VeilPayAPI.join(providers, VEILPAY_CONTRACT_ADDRESS)
}

/** Get (or build) the joined VeilPay API instance. Throws if not configured. */
export function getVeilPayAPI(): Promise<VeilPayApi> {
  if (!globalThis.__veilpay_api_promise__) {
    globalThis.__veilpay_api_promise__ = buildVeilPayApi().catch((err) => {
      // Do not cache failures: a fixed env/artifact setup should succeed on retry.
      globalThis.__veilpay_api_promise__ = undefined
      throw err
    })
  }
  return globalThis.__veilpay_api_promise__
}

/** Read the current ledger sequence (used to anchor intent TTLs). */
export async function getLedgerSequence(api: VeilPayApi): Promise<number> {
  const providers = api.providers as {
    publicDataProvider: {
      queryContractState(contract: unknown): Promise<{ data: { ledger: { sequence: number } } } | null>
    }
  }
  const state = await providers.publicDataProvider.queryContractState(
    api.deployedContractAddress,
  )
  if (!state?.data?.ledger) {
    throw new Error('Unable to read VeilPay contract ledger state from the indexer.')
  }
  return Number(state.data.ledger.sequence)
}

function readStatusTag(status: unknown): VeilPayChainStatus {
  if (typeof status === 'string') return status as VeilPayChainStatus
  if (status && typeof status === 'object' && 'is' in (status as Record<string, unknown>)) {
    return String((status as Record<string, unknown>).is) as VeilPayChainStatus
  }
  return String(status) as VeilPayChainStatus
}

/** Read one intent directly from the on-chain ledger. */
export async function getChainIntent(
  api: VeilPayApi,
  chainIntentId: string,
): Promise<VeilPayChainIntent | null> {
  const providers = api.providers as {
    publicDataProvider: {
      queryContractState(contract: unknown): Promise<{
        data: { ledger: { sequence: number; intents: Map<bigint, VeilPayLedgerIntent> } }
      } | null>
    }
  }
  const state = await providers.publicDataProvider.queryContractState(
    api.deployedContractAddress,
  )
  if (!state?.data?.ledger) return null

  const raw = state.data.ledger.intents.get(BigInt(chainIntentId))
  if (!raw) return null

  return {
    id: chainIntentId,
    status: readStatusTag(raw.status),
    amount: String(raw.amount),
    paidAmount: String(raw.paidAmount ?? '0'),
    refundedAmount: String(raw.refundedAmount ?? '0'),
    expiresAtOps: String(raw.expiresAt ?? '0'),
  }
}

/** Map an on-chain intent status to the application status model. */
export function mapChainStatusToAppStatus(status: VeilPayChainStatus): string {
  switch (status) {
    case 'ACTIVE':
      return 'awaiting_payment'
    case 'PAID':
      return 'verified'
    case 'REFUNDED':
      return 'refunded'
    case 'CANCELLED':
      return 'cancelled'
    default:
      return 'awaiting_payment'
  }
}

/** Generate a fresh 32-byte payment secret as hex. */
export function generatePaymentSecret(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function isValidPaymentSecretHex(secret: unknown): secret is string {
  return typeof secret === 'string' && /^[0-9a-fA-F]{64}$/.test(secret.trim())
}

export function secretToBytes(secretHex: string): Uint8Array {
  const clean = secretHex.trim().toLowerCase()
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
