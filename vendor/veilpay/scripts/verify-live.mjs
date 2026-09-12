/*
 * Verify the deployed VeilPay contract by reading its live ledger state
 * through the gateway indexer, using the same SDK provider stack the
 * deployer uses (localhost relay injects the session header).
 *
 * Usage (from the repo root, after `npm install`):
 *   node --experimental-specifier-resolution=node scripts/verify-live.mjs
 *
 * Reads the contract address from cli/.veilpay-state/contract-address and a
 * cached gateway session token from cli/.veilpay-state/gw_session.json.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { WebSocket, WebSocketServer } from 'ws';

globalThis.WebSocket = WebSocket;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATEWAY = 'https://api-preprod.1am.xyz';
const EXPLORER = 'https://preprod.midnightexplorer.com';

const stateDir = path.join(root, 'cli', '.veilpay-state');
const tok = JSON.parse(fs.readFileSync(path.join(stateDir, 'gw_session.json'), 'utf8')).token;
const addr = fs.readFileSync(path.join(stateDir, 'contract-address'), 'utf8').trim();

// Minimal authenticated relay in front of the gateway indexer (HTTP only;
// this script never subscribes).
const server = http.createServer((req, res) => {
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    fetch(`${GATEWAY}/api/v4/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'X-Session-Token': tok },
      body: Buffer.concat(chunks),
    })
      .then(async (up) => {
        res.writeHead(up.status, { 'content-type': 'application/json' });
        res.end(Buffer.from(await up.arrayBuffer()));
      })
      .catch((e) => {
        res.writeHead(502);
        res.end(String(e));
      });
  });
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const { setNetworkId } = await import('@midnight-ntwrk/midnight-js-network-id');
setNetworkId('preprod');
const { indexerPublicDataProvider } = await import(
  '@midnight-ntwrk/midnight-js-indexer-public-data-provider'
);
const { ledger } = await import('../contract/src/managed/veilpay/contract/index.js');

const provider = indexerPublicDataProvider(
  `http://127.0.0.1:${port}/api/v4/graphql`,
  `ws://127.0.0.1:${port}/unused`,
);
const state = await provider.queryContractState(addr);
if (!state) {
  console.error('NO STATE at', addr);
  server.close();
  process.exit(1);
}
const L = ledger(state.data);
console.log('VEILPAY CONTRACT LIVE ON PREPROD');
console.log('address  :', addr);
console.log('explorer :', `${EXPLORER}/contracts/0x${addr}`);
console.log('sequence :', L.sequence.toString());
console.log('intents  :', Number(L.sequence));
for (let i = 1n; i <= L.sequence; i++) {
  if (!L.intents.member(i)) continue;
  const it = L.intents.lookup(i);
  console.log(
    `  #${i} status=${it.status} amount=${it.amount} paid=${it.paidAmount} refunded=${it.refundedAmount}`,
  );
}
server.close();
process.exit(0);
