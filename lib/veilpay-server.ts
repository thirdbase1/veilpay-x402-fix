/**
 * Server-only VeilPay v2 protocol integration (read path).
 *
 * Follows vendor/veilpay/docs/MIGRATION-V2-INVOICE.md:
 *  - The live web app does NOT use the 1AM gateway (api-preprod.1am.xyz).
 *    That endpoint is a DEPLOY-TIME workaround only (sponsored fees, hosted
 *    proving, authenticated indexer session). Shipping or reusing
 *    cli/.veilpay-state/gw_session.json in the site is explicitly forbidden.
 *  - Runtime reads use the public, unauthenticated Midnight preprod indexer
 *    plus the committed compiled ledger decoder under
 *    vendor/veilpay/contract/src/managed/veilpay2/.
 *  - Tx submission happens client-side: users sign via the Lace/1AM browser
 *    extension and pay fees from their own DUST. The server never holds keys.
 *
 * The vendored midnight-js packages are loaded through a runtime dynamic
 * import so the Next.js bundler never tries to inline the dependency tree;
 * they resolve their own node_modules from vendor/veilpay at runtime.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Live VeilPay v2 (shielded) contract on Midnight preprod (deployments/preprod-v2.json). */
export const VEILPAY_CONTRACT_ADDRESS =
  process.env.VEILPAY_CONTRACT_ADDRESS?.trim() ||
  '0x85a0f911bb554bf4b7e9a69bb2ee2c20a03b823b20274eade45c6b18f53583a7'

export const VEILPAY_NETWORK = 'preprod'

/** Public, unauthenticated preprod indexer (MIGRATION-V2-INVOICE.md). */
export const VEILPAY_INDEXER_HTTP =
  process.env.VEILPAY_INDEXER_HTTP?.trim() ||
  'https://indexer.preprod.midnight.network/api/v3/graphql'
export const VEILPAY_INDEXER_WS =
  process.env.VEILPAY_INDEXER_WS?.trim() ||
  'wss://indexer.preprod.midnight.network/api/v3/graphql/ws'

const VENDOR_ROOT = join(process.cwd(), 'vendor', 'veilpay')
const MANAGED_ARTIFACT = join(
  VENDOR_ROOT,
  'contract',
  'src',
  'managed',
  'veilpay2',
  'contract',
  'index.js',
)

export interface VeilPayReadiness {
  ready: boolean
  network: string
  contractAddress: string
  artifactsPresent: boolean
  missing: string[]
}

export function getVeilPayReadiness(): VeilPayReadiness {
  const artifactsPresent = existsSync(MANAGED_ARTIFACT)

  const missing: string[] = []
  if (!artifactsPresent) {
    missing.push(
      'Compiled contract artifacts: extract the "veilpay-managed" CI artifact into vendor/veilpay/contract/src/managed/',
    )
  }

  return {
    ready: missing.length === 0,
    network: VEILPAY_NETWORK,
    contractAddress: VEILPAY_CONTRACT_ADDRESS,
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

function dynamicImport(specifier: string): Promise<unknown> {
  // Escape the bundler: the vendored ESM workspaces must resolve their own
  // dependencies at runtime, not be inlined by Turbopack/webpack.
  const runtimeImport = new Function('specifier', 'return import(specifier)') as (
    s: string,
  ) => Promise<unknown>
  return runtimeImport(specifier)
}

/** v2 on-chain intent status enum order (managed ledger stores it numerically). */
export type VeilPayChainStatus = 'ACTIVE' | 'PAID' | 'REFUNDED' | 'CANCELLED'

/** v2 Intent struct projected to plain JSON-safe values. */
export interface VeilPayChainIntent {
  id: string
  status: VeilPayChainStatus
  /** Requested amount in the invoice's token base units. */
  amount: string
  paidAmount: string
  refundedAmount: string
  /** Ledger-operations deadline (sequence units), NOT wall-clock time. */
  expiresAtOps: string
  /** 32-byte token color hex; all-zeros means an open invoice (any token). */
  tokenColor: string
  /** 32-byte merchant zswap coin public key hex (settlement destination). */
  merchantCoinPk: string
  /** Receipt commitment hex when the invoice is settled, else null. */
  receipt: string | null
}

/** Parsed v2 ledger shape produced by the managed contract's ledger() function. */
interface ParsedLedger {
  sequence: bigint
  intents: {
    member(id: bigint): boolean
    lookup(id: bigint): {
      amount: unknown
      expiresAt: unknown
      status: unknown
      paidAmount: unknown
      refundedAmount: unknown
      tokenColor: unknown
      merchantCoinPk: unknown
    }
  }
  receipts: {
    member(id: bigint): boolean
    lookup(id: bigint): unknown
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __veilpay_ledger_provider__: Promise<{
    queryContractState(address: string): Promise<{ data: unknown } | null>
  }> | undefined
}

async function getLedgerProvider() {
  if (!globalThis.__veilpay_ledger_provider__) {
    globalThis.__veilpay_ledger_provider__ = (async () => {
      const vendorModules = join(VENDOR_ROOT, 'node_modules')
      const { setNetworkId } = (await dynamicImport(
        pathToFileURL(join(vendorModules, '@midnight-ntwrk', 'midnight-js-network-id')).href,
      )) as { setNetworkId(id: string): void }
      setNetworkId('preprod')

      const { indexerPublicDataProvider } = (await dynamicImport(
        pathToFileURL(
          join(vendorModules, '@midnight-ntwrk', 'midnight-js-indexer-public-data-provider'),
        ).href,
      )) as {
        indexerPublicDataProvider: (
          indexerUri: string,
          indexerWsUri: string,
        ) => { queryContractState(address: string): Promise<{ data: unknown } | null> }
      }

      return indexerPublicDataProvider(VEILPAY_INDEXER_HTTP, VEILPAY_INDEXER_WS)
    })().catch((err) => {
      // Do not cache failures: a transient indexer outage should retry.
      globalThis.__veilpay_ledger_provider__ = undefined
      throw err
    })
  }
  return globalThis.__veilpay_ledger_provider__
}

async function loadLedgerDecoder(): Promise<(data: unknown) => ParsedLedger> {
  const { ledger } = (await dynamicImport(pathToFileURL(MANAGED_ARTIFACT).href)) as {
    ledger: (data: unknown) => ParsedLedger
  }
  return ledger
}

/**
 * Read the live v2 ledger through the public indexer. Retries briefly —
 * the indexer intermittently returns null for very recent contracts.
 */
export async function readVeilPayLedger(): Promise<ParsedLedger> {
  const readiness = getVeilPayReadiness()
  if (!readiness.ready) {
    throw new VeilPayUnavailableError(readiness.missing)
  }

  const provider = await getLedgerProvider()
  const address = VEILPAY_CONTRACT_ADDRESS.replace(/^0x/, '')

  let state: { data: unknown } | null = null
  for (let attempt = 1; attempt <= 5 && !state; attempt++) {
    state = await provider.queryContractState(address)
    if (!state) await new Promise((r) => setTimeout(r, 3000))
  }
  if (!state?.data) {
    throw new Error('Unable to read VeilPay contract ledger state from the public indexer.')
  }

  const ledger = await loadLedgerDecoder()
  return ledger(state.data)
}

function toHex(value: unknown): string {
  if (value instanceof Uint8Array) {
    return Array.from(value, (b) => b.toString(16).padStart(2, '0')).join('')
  }
  return String(value)
}

function readStatusTag(status: unknown): VeilPayChainStatus {
  const STATUS_NAMES: Record<string, VeilPayChainStatus> = {
    '0': 'ACTIVE',
    '1': 'PAID',
    '2': 'REFUNDED',
    '3': 'CANCELLED',
  }
  let value: unknown = status
  if (value && typeof value === 'object' && 'is' in (value as Record<string, unknown>)) {
    value = (value as Record<string, unknown>).is
  }
  const key = String(value)
  return STATUS_NAMES[key] ?? (key as VeilPayChainStatus)
}

/** Read the current ledger sequence (invoice ids are dense: next = sequence + 1). */
export async function getLedgerSequence(): Promise<number> {
  const ledgerState = await readVeilPayLedger()
  return Number(ledgerState.sequence)
}

/** Read one invoice directly from the on-chain v2 ledger. */
export async function getChainIntent(chainIntentId: string): Promise<VeilPayChainIntent | null> {
  const ledgerState = await readVeilPayLedger()
  const id = BigInt(chainIntentId)
  if (!ledgerState.intents.member(id)) return null

  const raw = ledgerState.intents.lookup(id)
  const receipt = ledgerState.receipts.member(id)
    ? toHex(ledgerState.receipts.lookup(id))
    : null

  return {
    id: chainIntentId,
    status: readStatusTag(raw.status),
    amount: String(raw.amount),
    paidAmount: String(raw.paidAmount ?? '0'),
    refundedAmount: String(raw.refundedAmount ?? '0'),
    expiresAtOps: String(raw.expiresAt ?? '0'),
    tokenColor: toHex(raw.tokenColor),
    merchantCoinPk: toHex(raw.merchantCoinPk),
    receipt,
  }
}

/** Map an on-chain invoice status to the application status model. */
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

/** True when the hex string is all zeros (v2 "open invoice" token color). */
export function isOpenTokenColor(hex: string): boolean {
  return /^0*$/.test(hex)
}

/** Generate a fresh 32-byte claim code (payment secret) as hex. */
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
