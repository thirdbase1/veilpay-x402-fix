/*
 * Gateway lifecycle driver: run VeilPay payment-intent flows against the
 * contract already deployed on Midnight Preprod, through the sponsored 1AM
 * gateway (no faucet, no wallet sync, no local proof server).
 *
 * Commands (same surface as the faucet-path CLI):
 *   create <amount> [ttlOps]   merchant creates an intent; prints id + secret
 *   pay <id> <secretHex>       customer settles an intent with its secret
 *   refund <id> <amount>       merchant refunds a paid intent
 *   cancel <id>                merchant cancels an unpaid intent
 *   status [id]                ledger summary, or one intent
 *
 * Usage:
 *   npm --workspace cli run preprod-tx -- create 2500 50
 *   npm --workspace cli run preprod-tx -- pay 1 <secretHex>
 *   npm --workspace cli run preprod-tx -- status
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { VeilPayAPI } from '../../api/src/index.js';
import { ledger } from '../../contract/src/managed/veilpay/contract/index.js';
import { randomBytes } from '../../api/src/utils/index.js';
import { createLogger } from './logger-utils.js';
import { buildGatewayStack, ADDRESS_FILE, STATE_DIR, EXPLORER } from './gateway-stack.js';
const currentDir = path.resolve(fileURLToPath(import.meta.url), '..');
const deployedAddress = () => {
    const envAddr = process.env.VEILPAY_CONTRACT_ADDRESS;
    if (envAddr)
        return envAddr.trim();
    if (fs.existsSync(ADDRESS_FILE))
        return fs.readFileSync(ADDRESS_FILE, 'utf8').trim();
    return null;
};
const STATUS_NAMES = ['ACTIVE', 'PAID', 'REFUNDED', 'CANCELLED'];
const intentJson = (id, intent) => JSON.stringify({
    id: id.toString(),
    merchantId: toHex(intent.merchantId),
    amount: intent.amount.toString(),
    expiresAt: intent.expiresAt.toString(),
    status: STATUS_NAMES[Number(intent.status)] ?? String(intent.status),
    paidAmount: intent.paidAmount.toString(),
    refundedAmount: intent.refundedAmount.toString(),
}, null, 2);
const run = async (argv) => {
    const [command, ...rest] = argv;
    if (!command) {
        console.error('usage: preprod-tx <create|pay|refund|cancel|status> [args]');
        process.exitCode = 1;
        return;
    }
    const logger = await createLogger(path.resolve(STATE_DIR, '..', 'logs', 'preprod', `gateway-tx-${new Date().toISOString().slice(0, 10)}.log`));
    const address = deployedAddress();
    if (!address) {
        logger.error('no deployed contract recorded; run `preprod-gateway` first');
        process.exitCode = 1;
        return;
    }
    const { providers, close } = await buildGatewayStack(logger, {
        privateStateStoreName: 'veilpay-private-state',
    });
    try {
        logger.info(`joining VeilPay at ${address}`);
        const api = await VeilPayAPI.join(providers, address, logger);
        const readLedger = async () => {
            const state = await providers.publicDataProvider.queryContractState(address);
            if (!state)
                throw new Error(`no contract state at ${address}`);
            return ledger(state.data);
        };
        switch (command) {
            case 'create': {
                const amount = BigInt(rest[0] ?? '1000');
                const ttlOps = BigInt(rest[1] ?? '1000');
                const paymentSecret = randomBytes(32);
                const current = await readLedger();
                // Intent ids are dense (next id === sequence + 1) and the contract
                // checks `sequence <= expiresAt` at pay time, so anchor the deadline
                // to the current sequence.
                const expiresAt = current.sequence + ttlOps;
                const id = await api.createIntent(amount, expiresAt, paymentSecret);
                logger.info(`created intent ${id}`);
                console.log(JSON.stringify({
                    id: id.toString(),
                    amount: amount.toString(),
                    expiresAt: expiresAt.toString(),
                    paymentSecret: toHex(paymentSecret),
                    explorer: `${EXPLORER}/contracts/0x${address}`,
                }, null, 2));
                break;
            }
            case 'pay': {
                const id = BigInt(rest[0] ?? '');
                const secretHex = rest[1] ?? process.env.VEILPAY_PAYMENT_SECRET;
                if (!secretHex) {
                    logger.error('usage: pay <id> <payment-secret-hex>');
                    process.exitCode = 1;
                    break;
                }
                const secret = new Uint8Array(Buffer.from(secretHex.replace(/^0x/, ''), 'hex'));
                await api.pay(id, secret);
                const paid = await api.isPaid(id);
                logger.info(`paid intent ${id}; isPaid=${paid}`);
                console.log(JSON.stringify({ id: id.toString(), isPaid: paid }, null, 2));
                break;
            }
            case 'refund': {
                const id = BigInt(rest[0] ?? '');
                const amount = BigInt(rest[1] ?? '0');
                await api.refund(id, amount);
                logger.info(`refunded intent ${id} (${amount})`);
                console.log(JSON.stringify({ id: id.toString(), refundAmount: amount.toString() }, null, 2));
                break;
            }
            case 'cancel': {
                const id = BigInt(rest[0] ?? '');
                await api.cancel(id);
                logger.info(`cancelled intent ${id}`);
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
                    console.log(intentJson(id, l.intents.lookup(id)));
                }
                else {
                    const intents = [];
                    for (let i = 1n; i <= l.sequence; i++) {
                        if (l.intents.member(i))
                            intents.push(JSON.parse(intentJson(i, l.intents.lookup(i))));
                    }
                    console.log(JSON.stringify({ address, explorer: `${EXPLORER}/contracts/0x${address}`, sequence: l.sequence.toString(), intents }, null, 2));
                }
                break;
            }
            default:
                logger.error(`unknown command: ${command}`);
                process.exitCode = 1;
        }
        void currentDir;
    }
    finally {
        await close();
    }
};
await run(process.argv.slice(2));
//# sourceMappingURL=gateway-cli.js.map