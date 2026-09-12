/*
 * Gateway deploy path: deploys VeilPay to Midnight Preprod through the
 * sponsored 1AM gateway -- no faucet, no wallet sync, no local proof server.
 *
 * The provider stack (hosted proving, sponsored dust balancing, RPC
 * submission, authenticated indexer relay, and the HTTP polling watches that
 * make transaction inclusion actually resolve) lives in ./gateway-stack.ts.
 * See docs/DEPLOYMENT.md for the full operational story.
 */
import fs from 'node:fs';
import path from 'node:path';
import { VeilPayAPI } from '../../api/src/index.js';
import { createLogger } from './logger-utils.js';
import { buildGatewayStack, ADDRESS_FILE, STATE_DIR } from './gateway-stack.js';
export const runGatewayDeploy = async () => {
    const logger = await createLogger(path.resolve(STATE_DIR, '..', 'logs', 'preprod', `gateway-${new Date().toISOString().slice(0, 10)}.log`));
    logger.info('deploying VeilPay through the sponsored gateway (no faucet, no sync)');
    const { providers, session, close } = await buildGatewayStack(logger);
    try {
        const api = await VeilPayAPI.deploy(providers, logger);
        fs.mkdirSync(STATE_DIR, { recursive: true });
        fs.writeFileSync(ADDRESS_FILE, api.deployedContractAddress);
        logger.info(`Deployed VeilPay at ${api.deployedContractAddress}`);
        console.log(JSON.stringify({
            contractAddress: api.deployedContractAddress,
            deployerAddress: session.address,
            network: 'preprod',
            path: 'gateway-sponsored',
        }, null, 2));
    }
    finally {
        await close();
    }
};
await runGatewayDeploy();
//# sourceMappingURL=gateway-deploy.js.map