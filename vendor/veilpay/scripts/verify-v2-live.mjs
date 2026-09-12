/*
 * Verify the deployed VeilPay v2 contract by reading its live shielded-token
 * ledger through the gateway indexer (HTTP relay; no SDK join, so the flaky
 * deploy-by-address lookup cannot block the read).
 *
 * Usage (from the repo root, after `npm install`):
 *   node --experimental-specifier-resolution=node scripts/verify-v2-live.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';

globalThis.WebSocket = WebSocket;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATEWAY = 'https://api-preprod.1am.xyz';
const EXPLORER = 'https://preprod.midnightexplorer.com';

const stateDir = path.join(root, 'cli', '.veilpay-state');
const tok = JSON.parse(fs.readFileSync(path.join(stateDir, 'gw_session.json'), 'utf8')).token;
const addr = fs.existsSync(path.join(stateDir, 'contract-address-v2'))
  ? fs.readFileSync(path.join(stateDir, 'contract-address-v2'), 'utf8').trim()
  : '85a0f911bb554bf4b7e9a69bb2ee2c20a03b823b20274eade45c6b18f53583a7';

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
const { ledger, IntentStatus } = await import(
  '../contract/src/managed/veilpay2/contract/index.js'
);

const provider = indexerPublicDataProvider(
  `http://127.0.0.1:${port}/api/v4/graphql`,
  `ws://127.0.0.1:${port}/unused`,
);
let state = null;
for (let attempt = 1; attempt <= 5 && !state; attempt++) {
  state = await provider.queryContractState(addr);
  if (!state) await new Promise((r) => setTimeout(r, 3000));
}
if (!state) {
  console.error('NO STATE at', addr);
  server.close();
  process.exit(1);
}
const L = ledger(state.data);
const STATUS = ['ACTIVE', 'PAID', 'REFUNDED', 'CANCELLED'];
const hex = (b) => Buffer.from(b).toString('hex');
console.log('VEILPAY v2 CONTRACT LIVE ON PREPROD (shielded token transfers)');
console.log('address  :', addr);
console.log('explorer :', `${EXPLORER}/contracts/0x${addr}`);
console.log('sequence :', L.sequence.toString());
for (let i = 1n; i <= L.sequence; i++) {
  if (!L.intents.member(i)) continue;
  const it = L.intents.lookup(i);
  console.log(
    `  #${i} status=${STATUS[it.status] ?? it.status} amount=${it.amount}` +
      ` color=${hex(it.tokenColor).slice(0, 16)}... merchantPk=${hex(it.merchantCoinPk).slice(0, 16)}...` +
      ` receipt=${L.receipts.member(i)}`,
  );
}
void IntentStatus;
server.close();
process.exit(0);
