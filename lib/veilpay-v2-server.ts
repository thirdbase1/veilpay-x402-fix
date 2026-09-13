/**
 * Server-only VeilPay v2 WRITE path (server-issued invoices).
 *
 * Phase 1 of the v2 kit migration: the SERVER — not the browser wallet —
 * issues invoices over the vendored gateway stack (hosted proving, sponsored
 * balancing, RPC submission via api-preprod.1am.xyz). The browser stays
 * connect + read-only until Phase 2 browser pay lands.
 *
 * The vendored ESM workspaces are loaded through a runtime dynamic import so
 * the Next.js bundler never inlines their dependency tree; they resolve their
 * own dependencies from the project node_modules at runtime (same escape
 * hatch as lib/veilpay-server.ts).
 *
 * Serverless notes:
 *  - The filesystem is read-only outside /tmp, so VEILPAY_STATE_DIR is
 *    defaulted to /tmp/veilpay-state on Vercel BEFORE gateway-stack.js is
 *    imported (it computes STATE_DIR at module load).
 *  - /tmp is ephemeral per instance: the gateway session and leveldb private
 *    state are re-established on cold start from VEILPAY_SEED.
 */

import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { VEILPAY_CONTRACT_ADDRESS } from '@/lib/veilpay-server'

/** Live VeilPay v2 contract on Midnight preprod (overridable). */
export const VEILPAY_CONTRACT_ADDRESS_V2 =
  process.env.VEILPAY_CONTRACT_ADDRESS_V2?.trim() ||
  VEILPAY_CONTRACT_ADDRESS

const VENDOR_ROOT = join(process.cwd(), 'vendor', 'veilpay')
const GATEWAY_STACK_JS = join(VENDOR_ROOT, 'cli', 'src', 'gateway-stack.js')
const VEILPAY2_API_JS = join(VENDOR_ROOT, 'api', 'src', 'index2.js')

function dynamicImport(specifier: string): Promise<unknown> {
  // Escape the bundler: vendor ESM must resolve its deps at runtime.
  const runtimeImport = new Function('specifier', 'return import(specifier)') as (
    s: string,
  ) => Promise<unknown>
  return runtimeImport(specifier)
}

/** Minimal pino-compatible console logger (avoids bundling pino into the app). */
const logger = {
  trace: (...args: unknown[]) => console.debug('[veilpay-v2]', ...args),
  debug: (...args: unknown[]) => console.debug('[veilpay-v2]', ...args),
  info: (...args: unknown[]) => console.info('[veilpay-v2]', ...args),
  warn: (...args: unknown[]) => console.warn('[veilpay-v2]', ...args),
  error: (...args: unknown[]) => console.error('[veilpay-v2]', ...args),
}

/**
 * Resolve and create the writable state dir. MUST run before gateway-stack.js
 * is imported — it reads VEILPAY_STATE_DIR once at module load.
 */
function ensureStateDir(): string {
  if (!process.env.VEILPAY_STATE_DIR) {
    process.env.VEILPAY_STATE_DIR = process.env.VERCEL
      ? '/tmp/veilpay-state'
      : join(process.cwd(), '.veilpay-state')
  }
  const dir = process.env.VEILPAY_STATE_DIR
  mkdirSync(dir, { recursive: true })
  return dir
}

/** The subset of VeilPay2API the server write path uses. */
export interface VeilPay2ApiLike {
  readonly deployedContractAddress: string
  createIntent(
    amount: bigint,
    expiresAt: bigint,
    tokenColor: Uint8Array,
    merchantCoinPk: Uint8Array,
    paymentSecret: Uint8Array,
  ): Promise<bigint>
}

/** The subset of the gateway stack the server write path uses. */
export interface GatewayStackProvidersLike {
  walletProvider: { getCoinPublicKey(): unknown }
  publicDataProvider: {
    queryContractState(address: string): Promise<{ data: unknown } | null>
  }
}

export interface VeilPayV2 {
  api: VeilPay2ApiLike
  providers: GatewayStackProvidersLike
  /** Contract address WITHOUT the 0x prefix (midnight-js convention). */
  address: string
  close(): Promise<void>
}

declare global {
  // eslint-disable-next-line no-var
  var __veilpay_v2_singleton__: Promise<VeilPayV2> | undefined
}

/**
 * Join the deployed v2 contract through the gateway stack. Cached per
 * process; failures are not cached so a transient gateway outage retries.
 */
export async function veilpayV2(): Promise<VeilPayV2> {
  if (!globalThis.__veilpay_v2_singleton__) {
    globalThis.__veilpay_v2_singleton__ = (async () => {
      ensureStateDir()

      const { buildGatewayStack } = (await dynamicImport(
        pathToFileURL(GATEWAY_STACK_JS).href,
      )) as {
        buildGatewayStack(
          logger: unknown,
          opts: {
            version: 'v2'
            privateStateStoreName: string
            deployTxHash?: string
          },
        ): Promise<{
          providers: GatewayStackProvidersLike
          close(): Promise<void>
        }>
      }
      const { VeilPay2API } = (await dynamicImport(
        pathToFileURL(VEILPAY2_API_JS).href,
      )) as {
        VeilPay2API: {
          join(
            providers: GatewayStackProvidersLike,
            address: string,
            logger: unknown,
          ): Promise<VeilPay2ApiLike>
        }
      }

      const stack = await buildGatewayStack(logger, {
        version: 'v2',
        privateStateStoreName: 'veilpay2-private-state',
        // The gateway indexer's deploy-by-address lookup returns ContractCall
        // (not ContractDeploy) for long-deployed contracts, which the vendor's
        // pollDeployTx cannot match — pass the known deploy tx hash so the
        // inclusion watch polls by hash instead (reliable path).
        deployTxHash: process.env.VEILPAY_DEPLOY_TX,
      })
      const address = VEILPAY_CONTRACT_ADDRESS_V2.replace(/^0x/, '')
      const api = await VeilPay2API.join(stack.providers, address, logger)
      return { api, providers: stack.providers, address, close: stack.close }
    })().catch((err) => {
      // Do not cache failures: a cold-start hiccup should retry cleanly.
      globalThis.__veilpay_v2_singleton__ = undefined
      throw err
    })
  }
  return globalThis.__veilpay_v2_singleton__
}

let writeChain: Promise<unknown> = Promise.resolve()

/**
 * Serialize on-chain writes (createIntent) per server instance. The v2
 * sequence anchor is read-then-write; concurrent invoices could otherwise
 * anchor expiry against a stale sequence.
 */
export function withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = writeChain.then(fn, fn)
  writeChain = run.catch(() => {})
  return run
}

/** Parse a 64-char hex string into exactly 32 bytes (contract field width). */
export function hexToBytes32(hex: string, field: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/^0x/, '')
  if (!/^[0-9a-f]{64}$/.test(clean)) {
    throw new Error(`${field} must be 64 hex characters, got: ${hex.slice(0, 80)}`)
  }
  const bytes = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
