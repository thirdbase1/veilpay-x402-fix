import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
export const currentDir = path.resolve(fileURLToPath(import.meta.url), '..');
export const PREPROD_ENDPOINTS = {
    indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
    nodeWS: 'wss://rpc.preprod.midnight.network',
    faucet: 'https://midnight-tmnight-preprod.nethermind.dev/',
    proofServer: 'https://proof-server.preprod.midnight.network',
};
export class PreprodConfig {
    privateStateStoreName = 'veilpay-private-state';
    logDir = path.resolve(currentDir, '..', 'logs', 'preprod');
    zkConfigPath = path.resolve(currentDir, '..', '..', 'contract', 'src', 'managed', 'veilpay');
    generateDust = true;
    fundFromFaucet = true;
    getEnvironment() {
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
    getEnvironment() {
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
//# sourceMappingURL=config.js.map