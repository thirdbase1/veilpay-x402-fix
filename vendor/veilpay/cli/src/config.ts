import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type EnvironmentConfiguration } from '@midnight-ntwrk/testkit-js';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

/*
 * Environment configuration for the VeilPay CLI.
 *
 * Unlike the upstream examples we do not depend on testkit's Docker
 * containers, because Midnight runs a public proof server on preprod.
 * `proofServer` can still be overridden with PROOF_SERVER_URL to point at
 * a local `docker compose -f proof-server.yml up` instance.
 */

export interface Config {
  readonly privateStateStoreName: string;
  readonly logDir: string;
  readonly zkConfigPath: string;
  readonly generateDust: boolean;
  readonly fundFromFaucet: boolean;
  getEnvironment(): EnvironmentConfiguration;
}

export const currentDir = path.resolve(fileURLToPath(import.meta.url), '..');

export const PREPROD_ENDPOINTS = {
  indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
  indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
  node: 'https://rpc.preprod.midnight.network',
  nodeWS: 'wss://rpc.preprod.midnight.network',
  faucet: 'https://midnight-tmnight-preprod.nethermind.dev/',
  proofServer: 'https://proof-server.preprod.midnight.network',
} as const;

export class PreprodConfig implements Config {
  privateStateStoreName = 'veilpay-private-state';
  logDir = path.resolve(currentDir, '..', 'logs', 'preprod');
  zkConfigPath = path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'veilpay');
  generateDust = true;
  fundFromFaucet = true;

  getEnvironment(): EnvironmentConfiguration {
    setNetworkId('preprod');
    return {
      walletNetworkId: 'preprod',
      networkId: 'preprod',
      ...PREPROD_ENDPOINTS,
      proofServer: process.env.PROOF_SERVER_URL ?? PREPROD_ENDPOINTS.proofServer,
    };
  }
}

export class PreviewConfig extends PreprodConfig {
  getEnvironment(): EnvironmentConfiguration {
    setNetworkId('preview');
    return {
      walletNetworkId: 'preview',
      networkId: 'preview',
      indexer: PREPROD_ENDPOINTS.indexer.replace('preprod', 'preview'),
      indexerWS: PREPROD_ENDPOINTS.indexerWS.replace('preprod', 'preview'),
      node: PREPROD_ENDPOINTS.node.replace('preprod', 'preview'),
      nodeWS: PREPROD_ENDPOINTS.nodeWS.replace('preprod', 'preview'),
      faucet: PREPROD_ENDPOINTS.faucet.replace('preprod', 'preview'),
      proofServer: process.env.PROOF_SERVER_URL ?? PREPROD_ENDPOINTS.proofServer.replace('preprod', 'preview'),
    };
  }
}
