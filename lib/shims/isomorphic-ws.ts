/**
 * Shim for the `isomorphic-ws` package, which Turbopack cannot bundle
 * (its node entry re-exports CJS named exports from 'ws'). The indexer
 * public-data provider only needs the WebSocket constructor.
 */

declare const require: (id: string) => unknown

type WsImpl = new (url: string, protocols?: string | string[]) => WebSocket

const globalImpl = (globalThis as { WebSocket?: unknown }).WebSocket

const impl: WsImpl =
  typeof globalImpl === 'function'
    ? (globalImpl as WsImpl)
    : (require('ws') as WsImpl)

export const WebSocket = impl
export default impl
