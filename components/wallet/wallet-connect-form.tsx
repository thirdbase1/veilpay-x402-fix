'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  AlertCircle,
  Loader2,
  Wallet,
  Puzzle,
  Download,
  RefreshCw,
} from 'lucide-react'
import Image from 'next/image'
import {
  detectInjectedWallets,
  enableWallet,
  type DetectedWallet,
  type WalletProviderId,
} from '@/lib/wallet/detect'

interface WalletConnectFormProps {
  /** Where to send the user after a successful connect. */
  redirect?: string
  initialError?: string | null
  /** Called after the session is minted (before navigation completes). */
  onSuccess?: () => void
}

/**
 * Wallet icon: prefer the wallet's own icon from its InitialAPI (may be a
 * hosted URL or base64 data URL — rendered with a plain img since next/image
 * cannot handle arbitrary remote/data sources), falling back to the bundled
 * brand marks for known wallets.
 */
function WalletIcon({ wallet, className }: { wallet: DetectedWallet; className?: string }) {
  const lower = `${wallet.id} ${wallet.name}`.toLowerCase()
  if (wallet.icon && !wallet.icon.startsWith('/')) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={wallet.icon} alt="" aria-hidden="true" className={`${className} rounded-md object-cover`} />
    )
  }
  if (lower.includes('lace')) {
    return <Image src="/wallets/lace.png" alt="" aria-hidden="true" width={32} height={32} className={`${className} rounded-sm`} />
  }
  if (lower.includes('1am')) {
    return <Image src="/wallets/1am.png" alt="" aria-hidden="true" width={32} height={32} className={`${className} rounded-full`} />
  }
  return <Puzzle className={className} />
}

/**
 * Extension-based wallet connect flow. Detects injected Midnight wallets
 * (Lace, 1AM) and signs in through the extension-approved handshake. Shared
 * by the /auth/login page and the inline wallet modal in the site nav.
 */
export function WalletConnectForm({
  redirect = '/app',
  initialError = null,
  onSuccess,
}: WalletConnectFormProps) {
  const router = useRouter()

  const [wallets, setWallets] = useState<DetectedWallet[] | null>(null)
  const [connectingId, setConnectingId] = useState<WalletProviderId | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError)
  const [isPending, startTransition] = useTransition()

  // Extensions inject their provider after page load — rescan briefly.
  useEffect(() => {
    const scan = () => setWallets(detectInjectedWallets())
    scan()
    const timers = [500, 1500, 3000].map((ms) => setTimeout(scan, ms))
    return () => timers.forEach(clearTimeout)
  }, [])

  function handleConnect(wallet: DetectedWallet) {
    setErrorMessage(null)
    setConnectingId(wallet.id)

    startTransition(async () => {
      try {
        const address = await enableWallet(wallet.id)

        const challengeRes = await fetch('/api/auth/wallet/challenge', { method: 'POST' })
        if (!challengeRes.ok) {
          throw new Error('Could not start wallet authentication. Please try again.')
        }
        const { nonce, timestamp } = (await challengeRes.json()) as {
          nonce: string
          timestamp: number
        }

        const verifyRes = await fetch('/api/auth/wallet/verify', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            mode: 'extension',
            walletId: wallet.id,
            address,
            nonce,
            timestamp,
          }),
        })
        const data = (await verifyRes.json()) as { error?: string; hasProfile?: boolean }
        if (!verifyRes.ok) {
          throw new Error(data.error ?? 'Wallet authentication failed. Please try again.')
        }

        onSuccess?.()
        router.push(data.hasProfile ? redirect : '/onboarding')
        router.refresh()
      } catch (err: unknown) {
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred during sign in.',
        )
        setConnectingId(null)
      }
    })
  }

  const isScanning = wallets === null
  const hasWallets = (wallets?.length ?? 0) > 0

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono text-primary font-medium">
          <Wallet className="size-3" />
          Midnight Wallet
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Connect your wallet
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Connect a Midnight wallet extension to sign in. Your keys stay inside the extension —
          only the account address is shared.
        </p>
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200"
        >
          <AlertCircle className="size-4 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMessage}</div>
        </div>
      )}

      <div className="mt-5 space-y-2.5">
        {isScanning && (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-border bg-background/60 py-6 text-xs text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Detecting wallet extensions...
          </div>
        )}

        {!isScanning &&
          wallets?.map((wallet) => {
            const isConnecting = connectingId === wallet.id && isPending
            return (
              <button
                key={wallet.id}
                type="button"
                onClick={() => handleConnect(wallet)}
                disabled={isPending}
                className="w-full flex items-center gap-3 rounded-lg border border-border bg-background/80 py-3 px-4 text-left hover:border-primary/50 hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40 text-foreground">
                  <WalletIcon wallet={wallet} className="size-4.5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{wallet.name}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {wallet.description}
                  </span>
                </span>
                {isConnecting ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <ArrowRight className="size-4 text-muted-foreground" />
                )}
              </button>
            )
          })}

        {!isScanning && !hasWallets && (
          <div className="rounded-lg border border-border bg-background/60 p-4 space-y-3">
            <div className="flex items-start gap-2.5 text-xs text-muted-foreground leading-relaxed">
              <AlertCircle className="size-4 text-muted-foreground shrink-0 mt-0.5" />
              <span>
                No Midnight wallet extension detected in this browser. Install Lace or the 1AM
                wallet extension, then refresh this page.
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <a
                href="https://www.lace.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <Image src="/wallets/lace.png" alt="" aria-hidden="true" width={14} height={14} className="size-3.5" />
                Install Lace
                <Download className="size-3 ml-auto text-muted-foreground" />
              </a>
              <a
                href="https://1am.xyz/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:border-primary/50 hover:bg-primary/5 transition-colors"
              >
                <Image src="/wallets/1am.png" alt="" aria-hidden="true" width={14} height={14} className="size-3.5 rounded-full" />
                Get 1AM Wallet
                <Download className="size-3 ml-auto text-muted-foreground" />
              </a>
            </div>
            <button
              type="button"
              onClick={() => setWallets(detectInjectedWallets())}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <RefreshCw className="size-3" />
              Search again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
