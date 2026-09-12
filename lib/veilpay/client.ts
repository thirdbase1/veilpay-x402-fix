'use client'

/**
 * Client-side VeilPay v2 issuance — the merchant's browser wallet signs and
 * relays contract transactions; the server never holds keys (per
 * docs/MIGRATION-V2-INVOICE.md).
 *
 * Provider stack:
 *  - walletProvider: the injected extension (v4 dApp Connector API). Balances
 *    dApp-built unsealed transactions via `balanceUnsealedTransaction` and
 *    relays the sealed result via `submitTransaction`.
 *  - publicDataProvider: the public preprod indexer (runtime reads never use
 *    the authenticated gateway session).
 *  - privateStateProvider: in-memory (merchant secret key + payment secrets
 *    never leave the browser).
 *  - provingProvider: the wallet's own prover when it exposes
 *    `getProvingProvider`.
 */

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id'
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
import { toHex } from '@midnight-ntwrk/midnight-js-utils'
import { Transaction } from '@midnight-ntwrk/ledger-v8'
import type {
  UnboundTransaction,
  WalletProvider,
} from '@midnight-ntwrk/midnight-js-types'
import type { FinalizedTransaction } from '@midnight-ntwrk/midnight-js-protocol/ledger'
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api'
import { VeilPay2API } from '../../vendor/veilpay/api/src/index2'
import { connectWalletApi } from '@/lib/wallet/detect'
import {
  VEILPAY_CONTRACT_ADDRESS,
  VEILPAY_INDEXER_HTTP,
  VEILPAY_INDEXER_WS,
} from '@/lib/veilpay/config'

const unhex = (hex: string): Uint8Array => {
  const clean = hex.replace(/^0x/, '')
  if (clean.length % 2 !== 0) throw new Error('odd-length hex string')
  return new Uint8Array(clean.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
}

/**
 * Minimal bech32m decoder — converts the connector's bech32m
 * `shieldedCoinPublicKey` into the raw 32-byte hex the contract expects.
 */
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'

function bech32mDecode(bech: string): Uint8Array {
  const pos = bech.lastIndexOf('1')
  if (pos < 1 || pos + 7 > bech.length) throw new Error('invalid bech32m string')
  const dataPart = bech.slice(pos + 1).toLowerCase()
  let acc = 0
  let bits = 0
  const out: number[] = []
  for (const ch of dataPart) {
    const v = CHARSET.indexOf(ch)
    if (v === -1) throw new Error('invalid bech32m character')
    acc = (acc << 5) | v
    bits += 5
    if (bits >= 8) {
      bits -= 8
      out.push((acc >> bits) & 0xff)
    }
  }
  return new Uint8Array(out)
}

/** Extension-backed midnight-js wallet provider. */
function createExtensionWalletProvider(api: ConnectedAPI, coinPkHex: string, encPkHex: string): WalletProvider {
  return {
    async balanceTx(tx: UnboundTransaction): Promise<FinalizedTransaction> {
      const serialized = toHex(tx.serialize())
      const { tx: balanced } = await api.balanceUnsealedTransaction(serialized, { payFees: true })
      return Transaction.deserialize('signature', 'proof', 'binding', unhex(balanced)) as never
    },
    getCoinPublicKey: () => coinPkHex as never,
    getEncryptionPublicKey: () => encPkHex as never,
  }
}

/** In-memory private state provider — secrets never leave the browser. */
function createInMemoryPrivateStateProvider() {
  const store = new Map<string, unknown>()
  let contractAddress: string | undefined
  const scoped = (id: string) => `${contractAddress ?? 'global'}:${id}`
  return {
    setContractAddress(address: string) {
      contractAddress = address
    },
    async get(id: string) {
      return store.get(scoped(id))
    },
    async set(id: string, state: unknown) {
      store.set(scoped(id), state)
    },
  }
}

export interface IssuedInvoice {
  chainIntentId: string
  expiresAtOps: string
  merchantCoinPk: string
  tokenColor: string
  paymentSecret: string
}

export interface IssueInvoiceArgs {
  /** Amount in micro-units (6 decimals). */
  amountMicro: bigint
  /** Ledger-operation TTL from the current sequence. */
  ttlOps: number
  /** 32-byte token color; zero bytes = open intent (any shielded token). */
  tokenColor?: Uint8Array
}

let cachedConnection: { api: ConnectedAPI; coinPkHex: string; encPkHex: string } | null = null

/** Connect the extension and resolve the merchant's coin public key (hex). */
export async function connectMerchantWallet(walletId: string): Promise<{ coinPkHex: string }> {
  if (cachedConnection) return { coinPkHex: cachedConnection.coinPkHex }

  const { api: looseApi } = await connectWalletApi(walletId)
  const api = looseApi as unknown as ConnectedAPI
  const addresses = await api.getShieldedAddresses()

  cachedConnection = {
    api,
    coinPkHex: toHex(bech32mDecode(addresses.shieldedCoinPublicKey)),
    encPkHex: toHex(bech32mDecode(addresses.shieldedEncryptionPublicKey)),
  }
  return { coinPkHex: cachedConnection.coinPkHex }
}

/** Build the full midnight-js provider stack backed by the extension + public indexer. */
async function buildProviderStack(api: ConnectedAPI, coinPkHex: string, encPkHex: string) {
  const walletProvider = createExtensionWalletProvider(api, coinPkHex, encPkHex)
  const publicDataProvider = indexerPublicDataProvider(VEILPAY_INDEXER_HTTP, VEILPAY_INDEXER_WS)

  return {
    privateStateProvider: createInMemoryPrivateStateProvider(),
    publicDataProvider,
    walletProvider,
    provingProvider: await api.getProvingProvider({
      getZKIR: async (circuitId: string) =>
        new Uint8Array(await (await fetch(`/veilpay/managed/zkir/${circuitId}.zkir`)).arrayBuffer()),
      getProverKey: async (circuitId: string) =>
        new Uint8Array(await (await fetch(`/veilpay/managed/keys/${circuitId}.prover`)).arrayBuffer()),
      getVerifierKey: async (circuitId: string) =>
        new Uint8Array(await (await fetch(`/veilpay/managed/keys/${circuitId}.verifier`)).arrayBuffer()),
    }),
    zkConfigProvider: {
      get(circuitId: string) {
        return (async () => ({
          zkirPath: `/veilpay/managed/zkir/${circuitId}.zkir`,
          verifierKeyPath: `/veilpay/managed/keys/${circuitId}.verifier`,
        }))()
      },
    },
  }
}

/**
 * Issue an on-chain invoice from the merchant's wallet.
 *
 * Builds and proves the `createIntent` call client-side, balances and submits
 * it through the extension, then returns the issuance result for registration
 * with the server (POST /api/intents verifies it against the public ledger).
 */
export async function issueInvoice(walletId: string, args: IssueInvoiceArgs): Promise<IssuedInvoice> {
  setNetworkId('preprod')

  const { api, coinPkHex, encPkHex } = cachedConnection
    ? cachedConnection
    : await connectMerchantWallet(walletId).then(() => cachedConnection!)

  const providers = await buildProviderStack(api, coinPkHex, encPkHex)
  const contractApi = await VeilPay2API.join(providers as never, VEILPAY_CONTRACT_ADDRESS as never)

  // Read the current sequence from the public ledger to derive the expiry.
  const state = await providers.publicDataProvider.queryContractState(VEILPAY_CONTRACT_ADDRESS)
  const veilpay2 = await import('../../vendor/veilpay/contract/src/managed/veilpay2/contract/index.js')
  const sequence = state ? veilpay2.ledger(state.data).sequence : 0n
  const expiresAt = sequence + BigInt(args.ttlOps)

  const paymentSecret = crypto.getRandomValues(new Uint8Array(32))
  const tokenColor = args.tokenColor ?? new Uint8Array(32)

  const chainIntentId = await contractApi.createIntent(
    args.amountMicro,
    expiresAt,
    tokenColor,
    unhex(coinPkHex),
    paymentSecret,
  )

  return {
    chainIntentId: chainIntentId.toString(),
    expiresAtOps: expiresAt.toString(),
    merchantCoinPk: coinPkHex,
    tokenColor: toHex(tokenColor),
    paymentSecret: toHex(paymentSecret),
  }
}

/** A spendable shielded coin the payer selected in their synced wallet. */
export interface PayerCoin {
  /** 32-byte hex coin nonce. */
  nonce: string
  /** 32-byte hex token color (zero bytes = native/open). */
  color: string
  /** Coin value in micro-units. */
  value: bigint
  /** Merkle-tree index of the coin commitment. */
  mtIndex: bigint
}

/**
 * Settle an invoice from the payer's wallet: proves and submits the v2
 * `pay(intentId, coin)` circuit call, spending a real shielded coin (change
 * returns to the payer). The claim code (payment secret) stays client-side.
 *
 * Coin discovery requires a funded, synced shielded wallet — the extension
 * API does not enumerate coins yet, so the coin is supplied explicitly
 * (docs/MIGRATION-V2-INVOICE.md "Payer funding caveat").
 */
export async function payInvoice(
  walletId: string,
  args: { chainIntentId: string; paymentSecret: string; coin: PayerCoin },
): Promise<{ submitted: true }> {
  setNetworkId('preprod')

  const { api, coinPkHex, encPkHex } = cachedConnection
    ? cachedConnection
    : await connectMerchantWallet(walletId).then(() => cachedConnection!)

  const providers = await buildProviderStack(api, coinPkHex, encPkHex)
  const contractApi = await VeilPay2API.join(providers as never, VEILPAY_CONTRACT_ADDRESS as never)

  await contractApi.pay(BigInt(args.chainIntentId), unhex(args.paymentSecret), {
    nonce: unhex(args.coin.nonce),
    color: unhex(args.coin.color),
    value: args.coin.value,
    mtIndex: args.coin.mtIndex,
  })

  return { submitted: true }
}
