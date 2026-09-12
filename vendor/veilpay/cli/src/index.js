/*
 * VeilPay CLI: non-interactive driver for deploy + payment-intent flows.
 *
 * Commands:
 *   deploy                        deploy a fresh VeilPay contract (records its address)
 *   create <amount> [ttlOps]      merchant creates a payment intent, prints id + secret
 *   pay <id> <secretHex>          customer settles an intent with its payment secret
 *   cancel <id>                   merchant cancels an unpaid intent
 *   refund <id> <amount>          merchant refunds a paid intent
 *   status [id]                   print ledger summary, or one intent
 *
 * Wallet identity persists in a seed file; contract address in a sibling file.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import { levelPrivateStateProvider } from '@midnight-ntwrk/midnight-js-level-private-state-provider';
import { unshieldedToken } from '@midnight-ntwrk/midnight-js-protocol/ledger';
import { toHex } from '@midnight-ntwrk/midnight-js-utils';
import { VeilPayAPI } from '../../api/src/index.js';
import { ledger } from '../../contract/src/managed/veilpay/contract/index.js';
import { createLogger } from './logger-utils.js';
import { MidnightWalletProvider } from './midnight-wallet-provider.js';
import { syncWallet, waitForUnshieldedFunds } from './wallet-utils.js';
import { generateDust } from './generate-dust.js';
import { randomBytes } from '../../api/src/utils/index.js';
// Needed for WebSocket usage through the wallet/indexer providers.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
globalThis.WebSocket = WebSocket;
export const currentDir = path.resolve(fileURLToPath(import.meta.url), '..');
const STATE_DIR = path.resolve(currentDir, '..', '.veilpay-state');
const seedFile = () => path.join(STATE_DIR, 'wallet.seed');
const addressFile = () => path.join(STATE_DIR, 'contract-address');
const ensureStateDir = () => {
    fs.mkdirSync(STATE_DIR, { recursive: true });
};
const loadSeed = () => {
    const envSeed = process.env.VEILPAY_SEED;
    if (envSeed)
        return envSeed.trim();
    if (fs.existsSync(seedFile()))
        return fs.readFileSync(seedFile(), 'utf8').trim();
    const seed = Buffer.from(randomBytes(32)).toString('hex');
    ensureStateDir();
    fs.writeFileSync(seedFile(), seed);
    return seed;
};
const deployedAddress = () => {
    const envAddr = process.env.VEILPAY_CONTRACT_ADDRESS;
    if (envAddr)
        return envAddr.trim();
    return fs.existsSync(addressFile()) ? fs.readFileSync(addressFile(), 'utf8').trim() : null;
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
export const run = async (config, argv, logger) => {
    const [command, ...rest] = argv;
    if (!command) {
        logger.error('usage: veilpay <deploy|create|pay|cancel|refund|status> [args]');
        process.exitCode = 1;
        return;
    }
    const env = config.getEnvironment();
    logger.info(`using proof server: ${env.proofServer}`);
    const seed = loadSeed();
    const walletProvider = await MidnightWalletProvider.build(logger, env, seed);
    await walletProvider.start();
    try {
        const unshieldedState = await waitForUnshieldedFunds(logger, walletProvider.wallet, env, unshieldedToken(), config.fundFromFaucet);
        logger.info(`NIGHT balance: ${unshieldedState.balances[unshieldedToken().raw] ?? 0n}`);
        if (config.generateDust) {
            const dustTx = await generateDust(logger, seed, unshieldedState, walletProvider.wallet);
            if (dustTx) {
                logger.info(`dust registration tx: ${dustTx}`);
                await syncWallet(logger, walletProvider.wallet);
            }
        }
        const zkConfigProvider = new NodeZkConfigProvider(config.zkConfigPath);
        const providers = {
            privateStateProvider: levelPrivateStateProvider({
                privateStateStoreName: config.privateStateStoreName,
                signingKeyStoreName: `${config.privateStateStoreName}-signing-keys`,
                privateStoragePasswordProvider: () => 'VeilPay-Local-2026!',
                accountId: seed,
            }),
            publicDataProvider: indexerPublicDataProvider(env.indexer, env.indexerWS),
            zkConfigProvider,
            proofProvider: httpClientProofProvider(env.proofServer, zkConfigProvider),
            walletProvider,
            midnightProvider: walletProvider,
        };
        if (command === 'deploy') {
            const api = await VeilPayAPI.deploy(providers, logger);
            ensureStateDir();
            fs.writeFileSync(addressFile(), api.deployedContractAddress);
            logger.info(`Deployed VeilPay at ${api.deployedContractAddress}`);
            console.log(JSON.stringify({ contractAddress: api.deployedContractAddress }, null, 2));
            return;
        }
        const address = deployedAddress();
        if (!address) {
            logger.error('no deployed contract recorded; run `deploy` first or set VEILPAY_CONTRACT_ADDRESS');
            process.exitCode = 1;
            return;
        }
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
                console.log(JSON.stringify({ id: id.toString(), amount: amount.toString(), paymentSecret: toHex(paymentSecret) }, null, 2));
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
                break;
            }
            case 'cancel': {
                await api.cancel(BigInt(rest[0] ?? ''));
                logger.info(`cancelled intent ${rest[0]}`);
                break;
            }
            case 'refund': {
                const id = BigInt(rest[0] ?? '');
                const amount = BigInt(rest[1] ?? '0');
                await api.refund(id, amount);
                logger.info(`refunded intent ${id} (${amount})`);
                break;
            }
            case 'status': {
                const l = await readLedger();
                if (rest[0]) {
                    const id = BigInt(rest[0]);
                    console.log(intentJson(id, l.intents.lookup(id)));
                }
                else {
                    console.log(JSON.stringify({ sequence: l.sequence.toString() }, null, 2));
                }
                break;
            }
            default:
                logger.error(`unknown command: ${command}`);
                process.exitCode = 1;
        }
    }
    finally {
        try {
            await walletProvider.stop();
        }
        catch (e) {
            logger.warn(`wallet stop failed: ${String(e)}`);
        }
    }
};
export const main = async (config) => {
    fs.mkdirSync(config.logDir, { recursive: true });
    const logger = await createLogger(path.join(config.logDir, `${new Date().toISOString().slice(0, 10)}.log`));
    try {
        await run(config, process.argv.slice(2), logger);
    }
    catch (e) {
        if (e instanceof Error) {
            logger.error(`fatal: ${e.message}`);
            logger.debug(e.stack ?? '');
        }
        else {
            logger.error(`fatal (unknown error type): ${String(e)}`);
        }
        process.exitCode = 1;
    }
};
//# sourceMappingURL=index.js.map