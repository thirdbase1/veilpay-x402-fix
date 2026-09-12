/**
 * Public (unauthenticated) Midnight preprod provider bootstrap.
 *
 * Lives inside vendor/veilpay so bare-specifier imports resolve against the
 * vendored node_modules. The Next.js server loads this through a runtime
 * dynamic import (see lib/veilpay-server.ts) so the bundler never inlines
 * the midnight-js dependency tree.
 *
 * Per docs/MIGRATION-V2-INVOICE.md: runtime reads use the public indexer —
 * never the authenticated 1AM gateway session.
 */

const imp = (specifier) => new Function('specifier', 'return import(specifier)')(specifier)

export function createPublicLedgerProvider(indexerHttp, indexerWs) {
  return (async () => {
    const { setNetworkId } = await imp('@midnight-ntwrk/midnight-js-network-id')
    setNetworkId('preprod')
    const { indexerPublicDataProvider } = await imp(
      '@midnight-ntwrk/midnight-js-indexer-public-data-provider',
    )
    return indexerPublicDataProvider(indexerHttp, indexerWs)
  })()
}
