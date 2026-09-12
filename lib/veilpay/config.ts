/**
 * Client-safe VeilPay constants (no server-only imports — this module is
 * bundled into the browser). Mirrors the defaults in lib/veilpay-server.ts.
 */

export const VEILPAY_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_VEILPAY_CONTRACT_ADDRESS?.trim() ||
  '0x85a0f911bb554bf4b7e9a69bb2ee2c20a03b823b20274eade45c6b18f53583a7'

export const VEILPAY_INDEXER_HTTP =
  process.env.NEXT_PUBLIC_VEILPAY_INDEXER_HTTP?.trim() ||
  'https://indexer.preprod.midnight.network/api/v3/graphql'

export const VEILPAY_INDEXER_WS =
  process.env.NEXT_PUBLIC_VEILPAY_INDEXER_WS?.trim() ||
  'wss://indexer.preprod.midnight.network/api/v3/graphql/ws'
