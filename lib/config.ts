/**
 * Public, browser-safe configuration for VeilPay.
 *
 * Only values that are safe to expose to the client belong here, and every one
 * is sourced from environment variables. Anything that is not configured is
 * simply `undefined` — the UI must treat missing values as "not available yet"
 * rather than inventing a fallback. Never place secrets, private keys, or RPC
 * credentials in this file.
 */

function readPublicEnv(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export const siteConfig = {
  name: 'VeilPay',
  tagline: 'Private payments. Public confidence.',
  description:
    'VeilPay lets merchants verify payments without exposing more customer information than necessary. Built with privacy-preserving technology on Midnight.',

  /** Canonical production URL. Unset until a real domain is configured. */
  url: readPublicEnv(process.env.NEXT_PUBLIC_SITE_URL),

  /** Public source repository. Only rendered when a real URL is configured. */
  repoUrl: readPublicEnv(process.env.NEXT_PUBLIC_REPO_URL),

  /** Social links — only rendered when real URLs are configured. */
  social: {
    x: readPublicEnv(process.env.NEXT_PUBLIC_SOCIAL_X_URL),
    discord: readPublicEnv(process.env.NEXT_PUBLIC_SOCIAL_DISCORD_URL),
  },

  /** External Midnight ecosystem reference. */
  midnightUrl: 'https://midnight.network',
} as const

/**
 * Non-secret, client-visible references to the Midnight deployment. These are
 * intentionally identifiers only (network id, public contract address) — never
 * endpoints that carry credentials. Server-only RPC URLs and keys must live in
 * server-only modules and never be prefixed with NEXT_PUBLIC_.
 */
export const midnightPublicConfig = {
  network: readPublicEnv(process.env.NEXT_PUBLIC_MIDNIGHT_NETWORK),
  contractAddress: readPublicEnv(process.env.NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS),
} as const

/** Whether the Midnight integration has enough public config to be considered wired. */
export function isMidnightConfigured(): boolean {
  return Boolean(midnightPublicConfig.network && midnightPublicConfig.contractAddress)
}

export const routes = {
  home: '/',
  app: '/app',
  explorer: '/explorer',
} as const
