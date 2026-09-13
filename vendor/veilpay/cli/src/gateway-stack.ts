/*
 * Shared "gateway stack" for running VeilPay against Midnight Preprod
 * through the sponsored 1AM gateway (https://api-preprod.1am.xyz).
 *
 * Why this exists: the official faucet path is unusable from scripts
 * (Cloudflare Turnstile makes its "OK" response a lie -- nothing is minted),
 * and the wallet SDK's shielded sync replays the entire zswap history. The
 * gateway sidesteps both:
 *
 *   /auth/*        Schnorr challenge-response -> session token
 *   /check+/prove  hosted proving, wire-compatible with the SDK's
 *                  httpClientProofProvider
 *   /balance-only  sponsored dust fee balancing (serialized proven tx in,
 *                  finalized tx out, with its Midnight tx hash)
 *   /rpc/midnight  JSON-RPC proxy (author_submitExtrinsic)
 *   /api/v4/graphql  authenticated indexer (HTTP + graphql-transport-ws)
 *
 * The one thing the gateway path cannot do is the SDK's default inclusion
 * watch: `submitTx` returns the *extrinsic* hash from author_submitExtrinsic,
 * while `watchForTxData` polls the indexer by Midnight *identifier* -- the
 * two never match, so deploy/call transactions hang forever. This module
 * fixes that by recording the Midnight tx hash the gateway returns from
 * /balance-only and polling the indexer by hash instead (verified against
 * preprod: transactions(offset:{hash}) resolves, identifier lookups do not).
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { WebSocketServer } from 'ws';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).WebSocket = WebSocket;

import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import type { LevelFactory } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { Level } from 'level';
import { Transaction, ZswapSecretKeys } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { type TransactionId } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import {
  FailEntirely,
  FailFallible,
  SucceedEntirely,
  SegmentSuccess,
  SegmentFail,
  type FinalizedTxData,
  type PublicDataProvider,
  type TxStatus,
} from '@midnight-ntwrk/midnight-js-types';
import { type VeilPayProviders, type PrivateStateId } from '../../api/src/common-types.js';
import { type VeilPayPrivateState } from '../../contract/src/witnesses.js';
import { type VeilPay2Providers, type PrivateStateId2 } from '../../api/src/common-types.js';
import { type VeilPay2PrivateState } from '../../contract/src/witnesses2.js';

const currentDir = path.resolve(fileURLToPath(import.meta.url), '..');
export const STATE_DIR = process.env.VEILPAY_STATE_DIR
  ? path.resolve(process.env.VEILPAY_STATE_DIR)
  : path.resolve(currentDir, '..', '.veilpay-state');
export const SESSION_FILE = path.join(STATE_DIR, 'gw_session.json');
export const ADDRESS_FILE = path.join(STATE_DIR, 'contract-address');

export const GATEWAY = 'https://api-preprod.1am.xyz';
const GW_INDEXER_HTTP = `${GATEWAY}/api/v4/graphql`;
const GW_INDEXER_WS = `wss://api-preprod.1am.xyz/api/v4/graphql/ws`;

export const EXPLORER = 'https://preprod.midnightexplorer.com';

/** Which compiled contract a stack/provision is built for. */
export type ContractVersion = 'v1' | 'v2';
export const ADDRESS_FILE_V2 = path.join(STATE_DIR, 'contract-address-v2');

type Logger = { info: (m: string) => void; warn?: (m: string) => void };

export interface GatewaySession {
  token: string;
  address: string;
  expires_in: number;
}

const hex = (b: Uint8Array): string => Buffer.from(b).toString('hex');
const unhex = (s: string): Uint8Array =>
  new Uint8Array(Buffer.from(s.replace(/^0x/, ''), 'hex'));
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export const loadSeed = (): string => {
  const envSeed = process.env.VEILPAY_SEED;
  if (envSeed) return envSeed.trim();
  const seedFile = path.join(STATE_DIR, 'wallet.seed');
  if (!fs.existsSync(seedFile)) {
    throw new Error(`no wallet seed at ${seedFile}; run the CLI once or set VEILPAY_SEED`);
  }
  return fs.readFileSync(seedFile, 'utf8').trim();
};

/**
 * Authenticate against the gateway with a BIP-340 Schnorr signature over the
 * challenge message, using the same NightExternal key the wallet SDK derives
 * from our seed. Session tokens are long-lived; cache and reuse.
 */
export async function gatewaySession(seed: string, logger: Logger): Promise<GatewaySession> {
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const cached = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) as GatewaySession;
      if (cached.token) return cached;
    } catch {
      /* re-auth below */
    }
  }

  const { schnorr } = (await import('@noble/curves/secp256k1.js')) as typeof import('@noble/curves/secp256k1.js');
  const { sha256 } = (await import('@noble/hashes/sha2.js')) as { sha256: (m: Uint8Array) => Uint8Array };
  const { HDWallet, Roles } = (await import('@midnight-ntwrk/wallet-sdk-hd')) as typeof import('@midnight-ntwrk/wallet-sdk-hd');

  const hd = HDWallet.fromSeed(unhex(seed));
  if (hd.type !== 'seedOk') throw new Error(`invalid seed: ${hd.type}`);
  const der = hd.hdWallet.selectAccount(0).selectRoles([Roles.NightExternal]).deriveKeysAt(0);
  if (der.type !== 'keysDerived') throw new Error('key derivation failed');
  const sk = der.keys[Roles.NightExternal];

  const chRes = await fetch(`${GATEWAY}/auth/challenge`, { signal: AbortSignal.timeout(20_000) });
  const ch = (await chRes.json()) as { nonce: string };
  const ts = Math.floor(Date.now() / 1000);
  const msgHash = sha256(new TextEncoder().encode(`1AM-AUTH-v1\n1am.xyz\n${ch.nonce}\n${ts}`));
  const sig = schnorr.sign(msgHash, sk);
  const pk = schnorr.getPublicKey(sk);

  const vRes = await fetch(`${GATEWAY}/auth/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce: ch.nonce, timestamp: ts, pubkey: hex(pk), signature: hex(sig) }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!vRes.ok) throw new Error(`gateway auth failed: ${vRes.status} ${await vRes.text()}`);
  const session = (await vRes.json()) as GatewaySession;
  // Read-only filesystems (Vercel serverless) must not fail the auth flow;
  // the session is simply re-established on the next cold start.
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(SESSION_FILE, JSON.stringify(session));
  } catch {
    logger.info('gateway session cache not persisted (read-only fs)');
  }
  logger.info(`gateway session established for ${session.address}`);
  return session;
}

/**
 * Local relay in front of the authenticated gateway indexer: plain HTTP for
 * queries and a WebSocket bridge for subscriptions, both injecting the
 * session token. Returns the base URL to hand to the SDK provider.
 */
async function startIndexerRelay(
  session: GatewaySession,
  logger: Logger,
): Promise<{ httpUrl: string; wsUrl: string; close: () => Promise<void> }> {
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      void fetch(GW_INDEXER_HTTP, {
        method: req.method ?? 'POST',
        headers: {
          'content-type': req.headers['content-type'] ?? 'application/json',
          'X-Session-Token': session.token,
        },
        body: req.method === 'GET' ? undefined : Buffer.concat(chunks),
      })
        .then(async (up) => {
          const body = Buffer.from(await up.arrayBuffer());
          res.writeHead(up.status, { 'content-type': up.headers.get('content-type') ?? 'application/json' });
          res.end(body);
        })
        .catch((e: Error) => {
          res.writeHead(502, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ errors: [{ message: `relay error: ${e.message}` }] }));
        });
    });
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (client) => {
    const upstream = new WebSocket(GW_INDEXER_WS, ['graphql-transport-ws'], {
      headers: { 'X-Session-Token': session.token },
    });
    const queue: string[] = [];
    upstream.on('open', () => {
      for (const m of queue.splice(0)) upstream.send(m);
    });
    client.on('message', (data) => {
      const msg = data.toString();
      if (upstream.readyState === WebSocket.OPEN) upstream.send(msg);
      else queue.push(msg);
    });
    upstream.on('message', (data) => {
      if (client.readyState === WebSocket.OPEN) client.send(data.toString());
    });
    const bye = (): void => {
      upstream.close();
      client.close();
    };
    client.on('close', bye);
    upstream.on('close', bye);
    client.on('error', bye);
    upstream.on('error', bye);
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('relay failed to bind');
  const port = address.port;
  logger.info(`indexer relay listening on 127.0.0.1:${port}`);
  return {
    httpUrl: `http://127.0.0.1:${port}/api/v4/graphql`,
    wsUrl: `ws://127.0.0.1:${port}/ws`,
    close: async () => {
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

// ---------------------------------------------------------------------------
// Indexer polling helpers (the inclusion-watch fix)
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */

const TX_BY_HASH_QUERY = `
  query($offset: TransactionOffset!) {
    transactions(offset: $offset) {
      id protocolVersion raw hash
      contractActions { address }
      block { height hash author timestamp }
      unshieldedCreatedOutputs { owner intentHash tokenType value }
      unshieldedSpentOutputs { owner intentHash tokenType value }
      ... on RegularTransaction {
        identifiers
        fees { estimatedFees paidFees }
        transactionResult { status segments { id success } }
      }
    }
  }`;

const DEPLOY_TX_QUERY = `
  query($address: HexEncoded!) {
    contractAction(address: $address) {
      ... on ContractDeploy { transaction {
        id protocolVersion raw hash
        contractActions { address }
        block { height hash author timestamp }
        unshieldedCreatedOutputs { owner intentHash tokenType value }
        unshieldedSpentOutputs { owner intentHash tokenType value }
        ... on RegularTransaction {
          identifiers
          fees { estimatedFees paidFees }
          transactionResult { status segments { id success } }
        }
      } }
      ... on ContractUpdate { transaction {
        id protocolVersion raw hash
        contractActions { address }
        block { height hash author timestamp }
        unshieldedCreatedOutputs { owner intentHash tokenType value }
        unshieldedSpentOutputs { owner intentHash tokenType value }
        ... on RegularTransaction {
          identifiers
          fees { estimatedFees paidFees }
          transactionResult { status segments { id success } }
        }
      } }
    }
  }`;

const toTxStatus = (transactionResult: any): TxStatus => {
  const result = transactionResult?.status;
  if (result === 'FAILURE') return FailEntirely;
  if (result === 'PARTIAL_SUCCESS') return FailFallible;
  if (result === 'SUCCESS') return SucceedEntirely;
  throw new Error(`unknown indexer transaction status: ${JSON.stringify(result)}`);
};

const toSegmentStatusMap = (transactionResult: any): Map<number, typeof SegmentSuccess | typeof SegmentFail> | undefined => {
  if (transactionResult?.status !== 'PARTIAL_SUCCESS' || !transactionResult.segments) return undefined;
  return new Map(
    transactionResult.segments.map((s: any) => [Number(s.id), s.success ? SegmentSuccess : SegmentFail]),
  );
};

const toUtxos = (list: any[]) =>
  (list ?? []).map((u) => ({
    owner: u.owner,
    intentHash: u.intentHash,
    tokenType: u.tokenType,
    value: BigInt(u.value),
  }));

const toFinalizedTxData = (transaction: any, txId: TransactionId): FinalizedTxData => ({
  // The SDK only consumes this field for error reporting; deserializing the
  // raw tx keeps the shape honest for anything that inspects it.
  tx: Transaction.deserialize('signature', 'proof', 'binding', unhex(transaction.raw)),
  status: toTxStatus(transaction.transactionResult),
  txId,
  identifiers: transaction.identifiers ?? [],
  txHash: transaction.hash,
  blockHeight: transaction.block.height,
  blockHash: transaction.block.hash,
  blockTimestamp: transaction.block.timestamp,
  blockAuthor: transaction.block.author,
  segmentStatusMap: toSegmentStatusMap(transaction.transactionResult),
  unshielded: {
    created: toUtxos(transaction.unshieldedCreatedOutputs),
    spent: toUtxos(transaction.unshieldedSpentOutputs),
  },
  indexerId: transaction.id,
  protocolVersion: transaction.protocolVersion,
  fees: {
    estimatedFees: transaction.fees?.estimatedFees ?? '0',
    paidFees: transaction.fees?.paidFees ?? '0',
  },
});

async function gqlQuery(session: GatewaySession, query: string, variables: unknown): Promise<any> {
  const res = await fetch(GW_INDEXER_HTTP, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Session-Token': session.token },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });
  const json = (await res.json()) as { data?: any; errors?: any[] };
  if (json.errors?.length) {
    throw new Error(`indexer query error: ${JSON.stringify(json.errors).slice(0, 300)}`);
  }
  return json.data;
}

const isRegular = (tx: any): boolean =>
  tx != null && 'identifiers' in tx && Array.isArray(tx.identifiers);

/** Poll the indexer by Midnight tx hash until the tx appears (or timeout). */
async function pollTxByHash(
  session: GatewaySession,
  hash: string,
  logger: Logger,
  timeoutMs = 240_000,
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const data = await gqlQuery(session, TX_BY_HASH_QUERY, { offset: { hash: `0x${hash}` } });
      const tx = data?.transactions?.[0];
      if (isRegular(tx)) return tx;
    } catch (e) {
      logger.warn?.(`indexer poll #${attempt} failed: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(3_000);
  }
  throw new Error(`indexer did not include tx 0x${hash} within ${timeoutMs / 1000}s`);
}

/** Poll the indexer for the deploy transaction of a contract address. */
async function pollDeployTx(
  session: GatewaySession,
  contractAddress: string,
  logger: Logger,
  timeoutMs = 240_000,
): Promise<any> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const data = await gqlQuery(session, DEPLOY_TX_QUERY, { address: contractAddress });
      const action = data?.contractAction;
      const tx = action?.transaction ?? action?.deploy?.transaction;
      if (isRegular(tx)) return tx;
    } catch (e) {
      logger.warn?.(`deploy poll #${attempt} failed: ${e instanceof Error ? e.message : e}`);
    }
    await sleep(3_000);
  }
  throw new Error(`indexer has no deploy tx for ${contractAddress} within ${timeoutMs / 1000}s`);
}

/**
 * Wrap the SDK indexer provider, replacing the two inclusion watches with
 * HTTP polling that works through the gateway:
 *
 *  - watchForTxData: the SDK polls by Midnight *identifier*, which never
 *    matches the *extrinsic* hash our submitTx returns. We poll by the tx
 *    *hash* the gateway reported from /balance-only instead (FIFO-ordered:
 *    balance -> submit -> watch is strictly sequential in midnight-js).
 *  - watchForDeployTxData: polls contractAction(address) directly, which the
 *    gateway indexer answers fine.
 */
export function withPollingWatches(
  base: PublicDataProvider,
  session: GatewaySession,
  pendingMidnightHashes: string[],
  logger: Logger,
  deployTxHash?: string,
): PublicDataProvider {
  return {
    ...base,
    async watchForTxData(txId: TransactionId): Promise<FinalizedTxData> {
      const hash =
        pendingMidnightHashes.shift() ?? String(txId).replace(/^0x/, '');
      logger.info(`watchForTxData: polling indexer by hash 0x${hash}`);
      const tx = await pollTxByHash(session, hash, logger);
      return toFinalizedTxData(tx, txId);
    },
    async watchForDeployTxData(contractAddress: string): Promise<FinalizedTxData> {
      logger.info(`watchForDeployTxData: polling indexer for deploy of ${contractAddress}`);
      // The gateway indexer's deploy-by-address lookup is flaky (returns null
      // for long-deployed contracts); when the deploy tx hash is known, poll
      // by hash instead, which the indexer answers reliably.
      const tx = deployTxHash
        ? await pollTxByHash(session, deployTxHash, logger)
        : await pollDeployTx(session, contractAddress, logger);
      const actionIndex = (tx.contractActions ?? []).findIndex(
        (a: any) => a.address === contractAddress,
      );
      const txId: TransactionId =
        actionIndex >= 0 ? tx.identifiers?.[actionIndex] : tx.identifiers?.[0] ?? contractAddress;
      return toFinalizedTxData(tx, txId);
    },
  };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Provider stack
// ---------------------------------------------------------------------------

export interface GatewayStack {
  providers: VeilPayProviders;
  session: GatewaySession;
  close: () => Promise<void>;
}

export interface GatewayStack2 {
  providers: VeilPay2Providers;
  session: GatewaySession;
  close: () => Promise<void>;
}

/**
 * Build the full VeilPay provider stack over the gateway: hosted proving,
 * sponsored balancing, RPC submission, relayed indexer queries, and the
 * polling inclusion watches described above.
 */
export async function buildGatewayStack(
  logger: Logger,
  opts: { version?: ContractVersion; privateStateStoreName?: string; deployTxHash?: string } = {},
): Promise<GatewayStack & GatewayStack2> {
  const version = opts.version ?? 'v1';
  setNetworkId('preprod');
  const seed = loadSeed();
  const session = await gatewaySession(seed, logger);

  // Direct key derivation -- no WalletFacade, so nothing ever syncs.
  const { HDWallet, Roles } = (await import('@midnight-ntwrk/wallet-sdk-hd')) as typeof import('@midnight-ntwrk/wallet-sdk-hd');
  const hd = HDWallet.fromSeed(unhex(seed));
  if (hd.type !== 'seedOk') throw new Error(`invalid seed: ${hd.type}`);
  const der = hd.hdWallet
    .selectAccount(0)
    .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
    .deriveKeysAt(0);
  if (der.type !== 'keysDerived') throw new Error('HD key derivation failed');
  hd.hdWallet.clear();

  // Shielded keys come from the raw seed (matches the faucet-path identity).
  const zswapSecretKeys = ZswapSecretKeys.fromSeed(unhex(seed));

  const zkConfigPath = path.resolve(
    currentDir, '..', '..', 'contract', 'src', 'managed',
    version === 'v2' ? 'veilpay2' : 'veilpay',
  );
  const zkConfigProvider = new NodeZkConfigProvider<'createIntent' | 'pay' | 'refund' | 'cancel'>(zkConfigPath);

  const relay = await startIndexerRelay(session, logger);

  // Midnight tx hashes reported by /balance-only, consumed in order by the
  // polling watchForTxData (balance -> submit -> watch is sequential).
  const pendingMidnightHashes: string[] = [];

  const walletProvider: VeilPayProviders['walletProvider'] = {
    getCoinPublicKey: () => zswapSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => zswapSecretKeys.encryptionPublicKey,
    async balanceTx(tx, ttl) {
      const serialized = tx.serialize();
      logger.info(`gateway balance-only: ${serialized.length} bytes proven tx (ttl ${ttl?.toISOString() ?? 'default'})`);
      // The gateway's own dust wallet sync goes transiently stale (503
      // WALLETS_UNAVAILABLE / DUST_SYNC_STALE, with a retryAfterMs hint).
      // Retry with the server's suggested wait, capped, before giving up.
      type BalancedResponse = { txBytes: string; txHash?: string; dustCost?: string };
      let json: BalancedResponse | null = null;
      for (let attempt = 0; attempt < 10; attempt++) {
        const res = await fetch(`${GATEWAY}/balance-only`, {
          method: 'POST',
          headers: { 'content-type': 'application/octet-stream', 'X-Session-Token': session.token },
          body: serialized,
          signal: AbortSignal.timeout(120_000),
        });
        if (res.ok) {
          json = (await res.json()) as BalancedResponse;
          break;
        }
        const body = await res.text();
        if (res.status === 503 && attempt < 9) {
          const waitMs = Math.min(Number(/"retryAfterMs":(\d+)/.exec(body)?.[1] ?? 5000) * (attempt + 1), 30_000);
          logger.info(`gateway /balance-only 503 (dust sync stale), retrying in ${waitMs}ms`);
          await sleep(waitMs);
          continue;
        }
        throw new Error(`gateway /balance-only failed: ${res.status} ${body}`);
      }
      if (!json) throw new Error('gateway /balance-only: retries exhausted');
      logger.info(`gateway balanced tx: hash=${json.txHash ?? 'n/a'} dustCost=${json.dustCost ?? 'sponsored'}`);
      if (json.txHash) pendingMidnightHashes.push(json.txHash.replace(/^0x/, ''));
      return Transaction.deserialize('signature', 'proof', 'binding', unhex(json.txBytes)) as never;
    },
  };

  let apiPromise: Promise<import('@polkadot/api').ApiPromise> | null = null;
  const getApi = async (): Promise<import('@polkadot/api').ApiPromise> => {
    if (!apiPromise) {
      apiPromise = (async (): Promise<import('@polkadot/api').ApiPromise> => {
        const { ApiPromise, HttpProvider } = await import('@polkadot/api');
        // Registers the midnight pallet types the wallet SDK ships.
        await import('@midnight-ntwrk/wallet-sdk-node-client');
        const provider = new HttpProvider(`${GATEWAY}/rpc/midnight`, {
          'X-Session-Token': session.token,
        });
        // The gateway proxy is rate-limited and its init burst (runtime
        // version + metadata + genesis) intermittently fails. On failure
        // polkadot-js can leave the create() promise unsettled, so race it
        // against a timeout and retry with backoff.
        let lastError: unknown;
        for (let attempt = 0; attempt < 6; attempt++) {
          try {
            const created = ApiPromise.create({ provider, noInitWarn: true });
            const timeout = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('rpc api init timed out')), 45_000),
            );
            const api = await Promise.race([created, timeout]);
            return api;
          } catch (e) {
            lastError = e;
            const delay = 2_000 * 2 ** attempt;
            logger.info(`rpc api init attempt ${attempt + 1} failed, retrying in ${delay}ms`);
            await new Promise((r) => setTimeout(r, delay));
          }
        }
        throw lastError;
      })().catch((e) => {
        apiPromise = null;
        throw e;
      });
    }
    return apiPromise;
  };

  const midnightProvider: VeilPayProviders['midnightProvider'] = {
    async submitTx(tx) {
      const api = await getApi();
      const serialized = tx.serialize();
      // HttpProvider has no subscriptions, so extrinsic .send() is
      // unavailable. Encode the unsigned midnight.sendMnTransaction extrinsic
      // with the API, then POST author_submitExtrinsic through the proxy.
      const call = api.tx.midnight.sendMnTransaction(`0x${hex(serialized)}`);
      const extHex = call.toHex();
      const res = await fetch(`${GATEWAY}/rpc/midnight`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'X-Session-Token': session.token },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'author_submitExtrinsic', params: [extHex] }),
        signal: AbortSignal.timeout(60_000),
      });
      const text = await res.text();
      let json: { result?: string; error?: { message?: string } };
      try {
        json = JSON.parse(text) as typeof json;
      } catch {
        throw new Error(`gateway submit returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
      }
      if (json.error) {
        throw new Error(`gateway submit rejected: ${json.error.message ?? JSON.stringify(json.error)} | full: ${text.slice(0, 400)}`);
      }
      if (!json.result) {
        throw new Error(`gateway submit returned no hash: ${text.slice(0, 200)}`);
      }
      logger.info(`submitted via gateway rpc: ${json.result}`);
      return json.result;
    },
  };

  const basePublicData = indexerPublicDataProvider(relay.httpUrl, relay.wsUrl);
  const storeName = opts.privateStateStoreName ?? (version === 'v2' ? 'veilpay2-private-state' : 'veilpay-private-state');
  const providers = {
    privateStateProvider: levelPrivateStateProvider<PrivateStateId, VeilPayPrivateState>({
      privateStateStoreName: storeName,
      signingKeyStoreName: `${storeName}-signing-keys`,
      privateStoragePasswordProvider: () => 'VeilPay-Local-2026!',
      accountId: seed,
      // Keep leveldb under the (writable) STATE_DIR — the app cwd is
      // read-only on Vercel serverless. Cast needed: pnpm resolves two
      // abstract-level majors (provider: 3.x, level@8: 1.x); runtime API
      // used by the provider is compatible.
      levelFactory: ((dbName: string) =>
        new Level(path.join(STATE_DIR, 'private-state', dbName), {
          createIfMissing: true,
        })) as unknown as LevelFactory,
    }) as unknown as VeilPayProviders['privateStateProvider'] & VeilPay2Providers['privateStateProvider'],
    publicDataProvider: withPollingWatches(
      basePublicData,
      session,
      pendingMidnightHashes,
      logger,
      opts.deployTxHash?.replace(/^0x/, ''),
    ),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(GATEWAY, zkConfigProvider, {
      headers: { 'X-Session-Token': session.token },
    }),
    walletProvider,
    midnightProvider,
  } as unknown as VeilPayProviders & VeilPay2Providers;

  return {
    providers,
    session,
    close: async () => {
      await relay.close();
      if (apiPromise) {
        try {
          (await apiPromise).disconnect();
        } catch {
          /* best effort */
        }
      }
    },
  };
}
