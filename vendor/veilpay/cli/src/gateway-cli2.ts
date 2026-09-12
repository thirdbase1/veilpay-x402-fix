/*
 * VeilPay v2 lifecycle driver: private payment intents WITH real shielded
 * token transfers, against the contract deployed on Midnight Preprod through
 * the sponsored 1AM gateway (no faucet, no wallet sync, no local proofs).
 *
 * Commands:
 *   create <amount> [ttlOps] [tokenColorHex]   merchant intent; prints id + secret
 *   pay <id> <secretHex> <value> [colorHex] [nonceHex] [mtIndex]
 *                                              settle AND move value on-chain
 *   refund <id> <amount>                       merchant records a refund
 *   cancel <id>                                merchant cancels an unpaid intent
 *   status [id]                                ledger summary or one intent
 *
 * Usage:
 *   npm --workspace cli run preprod-tx2 -- create 2500 50
 *   npm --workspace cli run preprod-tx2 -- pay 1 <secretHex> 2500
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { VeilPay2API, type SpendableCoin } from '../../api/src/index2.js';
import {
  ledger,
  type Intent,
  type Ledger,
} from '../../contract/src/managed/veilpay2/contract/index.js';
import { randomBytes } from '../../api/src/utils/index.js';
import { createLogger } from './logger-utils.js';
import { buildGatewayStack, ADDRESS_FILE_V2, STATE_DIR, EXPLORER } from './gateway-stack.js';

const deployedAddress = (): string | null => {
  const envAddr = process.env.VEILPAY_CONTRACT_ADDRESS;
  if (envAddr) return envAddr.trim();
  if (fs.existsSync(ADDRESS_FILE_V2)) return fs.readFileSync(ADDRESS_FILE_V2, 'utf8').trim();
  return null;
};

const STATUS_NAMES = ['ACTIVE', 'PAID', 'REFUNDED', 'CANCELLED'] as const;

const unhex32 = (s: string, label: string): Uint8Array => {
  const b = new Uint8Array(Buffer.from(s.replace(/^0x/, ''), 'hex'));
  if (b.length !== 32) throw new Error(`${label} must be 32 bytes of hex`);
  return b;
};

/* CoinPublicKey from the wallet provider is a 64-char hex string (32 bytes). */
const hexToBytes = (s: string): Uint8Array => new Uint8Array(Buffer.from(s.replace(/^0x/, ''), 'hex'));

const intentJson = (id: bigint, intent: Intent, hasReceipt: boolean): string =>
  JSON.stringify(
    {
      id: id.toString(),
      merchantId: toHex(intent.merchantId),
      merchantCoinPk: toHex(intent.merchantCoinPk),
      tokenColor: toHex(intent.tokenColor),
      amount: intent.amount.toString(),
      expiresAt: intent.expiresAt.toString(),
      status: STATUS_NAMES[Number(intent.status)] ?? String(intent.status),
      paidAmount: intent.paidAmount.toString(),
      refundedAmount: intent.refundedAmount.toString(),
      hasReceipt,
    },
    null,
    2,
  );

const run = async (argv: string[]): Promise<void> => {
  const [command, ...rest] = argv;
  if (!command) {
    console.error('usage: preprod-tx2 <create|pay|refund|cancel|status> [args]');
    process.exitCode = 1;
    return;
  }

  const logger = await createLogger(
    path.resolve(STATE_DIR, '..', 'logs', 'preprod', `gateway2-tx-${new Date().toISOString().slice(0, 10)}.log`),
  );

  const address = deployedAddress();
  if (!address) {
    logger.error('no v2 contract recorded; run `preprod-gateway2` first');
    process.exitCode = 1;
    return;
  }

  const stack = await buildGatewayStack(logger, {
    version: 'v2',
    privateStateStoreName: 'veilpay2-private-state',
  });
  const providers = stack.providers;

  try {
    logger.info(`joining VeilPay v2 at ${address}`);
    const api = await VeilPay2API.join(providers, address, logger);

    const readLedger = async (): Promise<Ledger> => {
      const state = await providers.publicDataProvider.queryContractState(address);
      if (!state) throw new Error(`no contract state at ${address}`);
      return ledger(state.data);
    };

    switch (command) {
      case 'create': {
        const amount = BigInt(rest[0] ?? '1000');
        const ttlOps = BigInt(rest[1] ?? '1000');
        const tokenColor = rest[2] ? unhex32(rest[2], 'tokenColor') : new Uint8Array(32);
        const merchantCoinPk = hexToBytes(String(providers.walletProvider.getCoinPublicKey()));
        if (merchantCoinPk.length !== 32) throw new Error('unexpected coin public key length');
        const paymentSecret = randomBytes(32);
        const current = await readLedger();
        const expiresAt = current.sequence + ttlOps;
        const id = await api.createIntent(amount, expiresAt, tokenColor, merchantCoinPk, paymentSecret);
        console.log(
          JSON.stringify(
            {
              id: id.toString(),
              amount: amount.toString(),
              expiresAt: expiresAt.toString(),
              tokenColor: toHex(tokenColor),
              merchantCoinPk: toHex(merchantCoinPk),
              paymentSecret: toHex(paymentSecret),
              explorer: `${EXPLORER}/contracts/0x${address}`,
            },
            null,
            2,
          ),
        );
        break;
      }
      case 'pay': {
        const id = BigInt(rest[0] ?? '');
        const secretHex = rest[1] ?? process.env.VEILPAY_PAYMENT_SECRET;
        const value = BigInt(rest[2] ?? '0');
        if (!secretHex || !value) {
          logger.error('usage: pay <id> <secretHex> <value> [colorHex] [nonceHex] [mtIndex]');
          process.exitCode = 1;
          break;
        }
        const coin: SpendableCoin = {
          value,
          color: rest[3] ? unhex32(rest[3], 'color') : new Uint8Array(32),
          nonce: rest[4] ? unhex32(rest[4], 'nonce') : randomBytes(32),
          mtIndex: rest[5] ? BigInt(rest[5]) : 0n,
        };
        await api.pay(id, unhex32(secretHex, 'paymentSecret'), coin);
        const paid = await api.isPaid(id);
        console.log(JSON.stringify({ id: id.toString(), isPaid: paid, spentValue: value.toString() }, null, 2));
        break;
      }
      case 'refund': {
        const id = BigInt(rest[0] ?? '');
        const amount = BigInt(rest[1] ?? '0');
        await api.refund(id, amount);
        console.log(JSON.stringify({ id: id.toString(), refundAmount: amount.toString() }, null, 2));
        break;
      }
      case 'cancel': {
        const id = BigInt(rest[0] ?? '');
        await api.cancel(id);
        console.log(JSON.stringify({ id: id.toString(), cancelled: true }, null, 2));
        break;
      }
      case 'status': {
        const l = await readLedger();
        if (rest[0]) {
          const id = BigInt(rest[0]);
          if (!l.intents.member(id)) {
            logger.error(`no intent ${id}`);
            process.exitCode = 1;
            break;
          }
          console.log(intentJson(id, l.intents.lookup(id), l.receipts.member(id)));
        } else {
          const intents: unknown[] = [];
          for (let i = 1n; i <= l.sequence; i++) {
            if (l.intents.member(i)) {
              intents.push(JSON.parse(intentJson(i, l.intents.lookup(i), l.receipts.member(i))));
            }
          }
          console.log(
            JSON.stringify(
              { address, explorer: `${EXPLORER}/contracts/0x${address}`, sequence: l.sequence.toString(), intents },
              null,
              2,
            ),
          );
        }
        break;
      }
      default:
        logger.error(`unknown command: ${command}`);
        process.exitCode = 1;
    }
  } finally {
    await stack.close();
  }
};

await run(process.argv.slice(2));
