/**
 * Entry point for loading the vendored VeilPay workspaces from the Next.js
 * server. The workspaces are compiled in place to plain ESM (tsc), so no
 * loader registration is needed — this just re-exports the two modules the
 * server integration uses.
 *
 * Loaded via a bundler-escaping dynamic import from lib/veilpay-server.ts.
 */
export { buildGatewayStack, STATE_DIR } from './cli/src/gateway-stack.js'
export { VeilPayAPI } from './api/src/index.js'
export { ledger } from './contract/src/managed/veilpay/contract/index.js'
