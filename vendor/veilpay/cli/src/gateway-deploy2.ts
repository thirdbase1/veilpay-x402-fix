/*
 * Deploy VeilPay v2 (shielded token transfers) through the sponsored 1AM
 * gateway, same no-faucet/no-sync path as v1. See docs/DEPLOYMENT.md.
 */

import fs from 'node:fs';
import path from 'node:path';
import { VeilPay2API } from '../../api/src/index2.js';
import { createLogger } from './logger-utils.js';
import { buildGatewayStack, ADDRESS_FILE_V2, STATE_DIR } from './gateway-stack.js';

const runGatewayDeploy2 = async (): Promise<void> => {
  const logger = await createLogger(
    path.resolve(STATE_DIR, '..', 'logs', 'preprod', `gateway2-${new Date().toISOString().slice(0, 10)}.log`),
  );

  logger.info('deploying VeilPay v2 through the sponsored gateway');
  const { providers, session, close } = await buildGatewayStack(logger, { version: 'v2' });
  try {
    const api = await VeilPay2API.deploy(providers, logger);
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(ADDRESS_FILE_V2, api.deployedContractAddress);
    logger.info(`Deployed VeilPay v2 at ${api.deployedContractAddress}`);
    console.log(
      JSON.stringify(
        {
          contractAddress: api.deployedContractAddress,
          deployerAddress: session.address,
          network: 'preprod',
          version: 'v2-shielded',
          path: 'gateway-sponsored',
        },
        null,
        2,
      ),
    );
  } finally {
    await close();
  }
};

await runGatewayDeploy2();
