/**
 * Typed boundary for a customer's Midnight-compatible wallet.
 *
 * The landing/merchant UI only ever depends on these types. No implementation
 * here connects to a wallet or fabricates an address/balance — a real connector
 * is provided once wallet support lands, and it must live client-side and
 * request explicit user consent.
 */

export type WalletConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'unsupported'

export interface WalletAccount {
  /** Public address the customer chose to expose to this dApp. */
  address: string
  network: string
}

export interface WalletConnector {
  readonly id: string
  readonly name: string
  /** Whether this connector is available in the current environment. */
  isAvailable(): boolean
  connect(): Promise<WalletAccount>
  disconnect(): Promise<void>
}

export class WalletUnavailableError extends Error {
  constructor(connectorName: string) {
    super(`${connectorName} wallet connector is not available yet.`)
    this.name = 'WalletUnavailableError'
  }
}
