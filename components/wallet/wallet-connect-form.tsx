'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowRight,
  AlertCircle,
  Loader2,
  Wallet,
  Copy,
  Check,
  ShieldCheck,
  KeyRound,
  Sparkles,
} from 'lucide-react'
import {
  deriveWalletKeys,
  generateRecoveryPhrase,
  buildLoginMessage,
  signLoginMessage,
  shortPublicKey,
} from '@/lib/wallet/oneam-auth'

type LoginMode = 'connect' | 'create'

interface WalletConnectFormProps {
  /** Where to send the user after a successful connect. */
  redirect?: string
  initialError?: string | null
  /** Called after the session is minted (before navigation completes). */
  onSuccess?: () => void
}

/**
 * The 1AM wallet connect / create flow. Shared by the /auth/login page and
 * the inline wallet modal opened from the site nav.
 */
export function WalletConnectForm({
  redirect = '/app',
  initialError = null,
  onSuccess,
}: WalletConnectFormProps) {
  const router = useRouter()

  const [mode, setMode] = useState<LoginMode>('connect')
  const [seedInput, setSeedInput] = useState('')
  const [generatedPhrase, setGeneratedPhrase] = useState<string[]>([])
  const [backupConfirmed, setBackupConfirmed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [walletLabel, setWalletLabel] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError)
  const [isPending, startTransition] = useTransition()

  async function authenticate(secretKey: Uint8Array, publicKey: string) {
    const challengeRes = await fetch('/api/auth/wallet/challenge', { method: 'POST' })
    if (!challengeRes.ok) {
      throw new Error('Could not start wallet authentication. Please try again.')
    }
    const { nonce, timestamp, message } = (await challengeRes.json()) as {
      nonce: string
      timestamp: number
      message: string
    }

    const { signature } = await signLoginMessage(secretKey, buildLoginMessage(nonce, timestamp))

    const verifyRes = await fetch('/api/auth/wallet/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ publicKey, signature, nonce, timestamp }),
    })
    const data = (await verifyRes.json()) as { error?: string; hasProfile?: boolean }
    if (!verifyRes.ok) {
      throw new Error(data.error ?? 'Wallet authentication failed. Please try again.')
    }

    onSuccess?.()
    router.push(data.hasProfile ? redirect : '/onboarding')
    router.refresh()
  }

  function handleConnect() {
    setErrorMessage(null)
    if (!seedInput.trim()) {
      setErrorMessage('Paste your seed or recovery phrase to connect.')
      return
    }

    startTransition(async () => {
      try {
        const { secretKey, publicKey } = await deriveWalletKeys(seedInput)
        setWalletLabel(shortPublicKey(publicKey))
        await authenticate(secretKey, publicKey)
      } catch (err: unknown) {
        setWalletLabel(null)
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred during sign in.',
        )
      }
    })
  }

  async function handleCreateMode() {
    setMode('create')
    setErrorMessage(null)
    setBackupConfirmed(false)
    setGeneratedPhrase([])
    try {
      const phrase = await generateRecoveryPhrase()
      setGeneratedPhrase(phrase.split(' '))
    } catch {
      setErrorMessage('Could not generate a wallet. Please refresh and try again.')
    }
  }

  function handleCreateConfirm() {
    if (!backupConfirmed) {
      setErrorMessage('Confirm you have written down the recovery phrase first.')
      return
    }
    setErrorMessage(null)

    startTransition(async () => {
      try {
        const { secretKey, publicKey } = await deriveWalletKeys(generatedPhrase.join(' '))
        setWalletLabel(shortPublicKey(publicKey))
        await authenticate(secretKey, publicKey)
      } catch (err: unknown) {
        setWalletLabel(null)
        setErrorMessage(
          err instanceof Error ? err.message : 'An unexpected error occurred during sign in.',
        )
      }
    })
  }

  async function handleCopyPhrase() {
    try {
      await navigator.clipboard.writeText(generatedPhrase.join(' '))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setErrorMessage('Clipboard access was blocked. Write the words down manually.')
    }
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono text-primary font-medium">
          <Wallet className="size-3" />
          1AM Wallet
        </div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
          Connect your wallet
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Sign in with your Midnight wallet key. Your seed never leaves this device — only a
          cryptographic signature is sent.
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

      {mode === 'connect' ? (
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="seed"
              className="block text-xs font-medium text-muted-foreground uppercase tracking-wider"
            >
              Seed or Recovery Phrase
            </label>
            <textarea
              id="seed"
              rows={3}
              required
              value={seedInput}
              onChange={(e) => setSeedInput(e.target.value)}
              placeholder="64-character hex seed or 12/24-word recovery phrase"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-lg border border-border bg-background/80 py-2.5 px-3 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition-colors resize-none"
            />
            <p className="text-[11px] text-muted-foreground">
              Handled locally with the same NightExternal key derivation the 1AM gateway uses.
            </p>
          </div>

          <button
            type="button"
            onClick={handleConnect}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{walletLabel ? `Signing in ${walletLabel}...` : 'Signing challenge...'}</span>
              </>
            ) : (
              <>
                <KeyRound className="size-4" />
                <span>Connect Wallet</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCreateMode}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 py-2.5 px-4 text-sm font-semibold text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles className="size-4" />
            <span>Create a New Wallet</span>
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {generatedPhrase.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
            </div>
          ) : (
            <>
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex items-start gap-2.5">
                <ShieldCheck className="size-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  Write these 24 words down and store them safely. They are the only way to
                  recover this wallet — they cannot be reset or reissued.
                </div>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {generatedPhrase.map((word, i) => (
                  <div
                    key={`${word}-${i}`}
                    className="flex items-baseline gap-1.5 rounded-md border border-border/70 bg-background/60 px-2 py-1.5"
                  >
                    <span className="text-[10px] font-mono text-muted-foreground/60">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-xs font-mono text-foreground truncate">{word}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleCopyPhrase}
                className="inline-flex items-center gap-1.5 text-xs text-primary/80 hover:text-primary transition-colors"
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? 'Copied to clipboard' : 'Copy phrase'}
              </button>

              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={backupConfirmed}
                  onChange={(e) => setBackupConfirmed(e.target.checked)}
                  className="mt-0.5 size-3.5 accent-[var(--primary)]"
                />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  I have written down my recovery phrase and understand it cannot be recovered if
                  lost.
                </span>
              </label>

              <button
                type="button"
                onClick={handleCreateConfirm}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    <span>Creating wallet...</span>
                  </>
                ) : (
                  <>
                    <span>Continue with New Wallet</span>
                    <ArrowRight className="size-4" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setMode('connect')}
                disabled={isPending}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                I already have a wallet
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
