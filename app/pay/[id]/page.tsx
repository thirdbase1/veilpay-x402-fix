'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { BrandWordmark } from '@/components/site/brand'
import { PaymentIntentStatusBadge } from '@/components/dashboard/payment-intent-status'
import { fetchPaymentIntent } from '@/lib/payments/service'
import { describeAmountCondition } from '@/lib/payments/intent'
import type { PaymentIntent } from '@/lib/payments/types'
import { midnightPublicConfig } from '@/lib/config'
import {
  ShieldCheck,
  AlertTriangle,
  Loader2,
  Lock,
  Wallet,
  Clock,
  CheckCircle2,
  Info,
} from 'lucide-react'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function CustomerPayPage({ params }: PageProps) {
  const { id } = use(params)

  const [intent, setIntent] = useState<PaymentIntent | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [walletDetected, setWalletDetected] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectedAddress, setConnectedAddress] = useState<string | null>(null)
  const [walletError, setWalletError] = useState<string | null>(null)

  useEffect(() => {
    fetchPaymentIntent(id)
      .then((data) => {
        setIntent(data)
        setIsLoading(false)
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Payment intent not found'
        setError(msg)
        setIsLoading(false)
      })

    // Check for real Midnight wallet injection
    if (typeof window !== 'undefined') {
      const win = window as unknown as {
        midnight?: { isAvailable?: boolean }
        cardano?: { laceMidnight?: unknown }
      }
      setWalletDetected(Boolean(win.midnight || win.cardano?.laceMidnight))
    }
  }, [id])

  const handleConnectWallet = async () => {
    setIsConnecting(true)
    setWalletError(null)

    try {
      const win = window as unknown as {
        midnight?: { enable?: () => Promise<{ getAddress: () => Promise<string> }> }
        cardano?: { laceMidnight?: { enable: () => Promise<{ getUsedAddresses?: () => Promise<string[]> }> } }
      }

      if (win.midnight?.enable) {
        const api = await win.midnight.enable()
        const addr = await api.getAddress()
        setConnectedAddress(addr)
      } else if (win.cardano?.laceMidnight?.enable) {
        const api = await win.cardano.laceMidnight.enable()
        const addrs = (await api.getUsedAddresses?.()) || []
        setConnectedAddress(addrs[0] || 'mn_payer_account')
      } else {
        setWalletError(
          'No Midnight-compatible wallet extension (such as Lace Midnight edition) was detected in this browser.',
        )
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Wallet connection rejected'
      setWalletError(msg)
    } finally {
      setIsConnecting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          Resolving payment intent from VeilPay protocol...
        </p>
      </div>
    )
  }

  if (error || !intent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
        <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-card/60 p-6 text-center space-y-4">
          <AlertTriangle className="mx-auto size-8 text-rose-400" />
          <h1 className="text-base font-semibold text-foreground">Payment Intent Unavailable</h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {error || `Intent "${id}" could not be retrieved from the protocol registry.`}
          </p>
          <Link
            href="/"
            className="inline-flex rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-secondary"
          >
            Go to VeilPay Home
          </Link>
        </div>
      </div>
    )
  }

  const isExpired = intent.status === 'expired'
  const isVerified = intent.status === 'verified'
  const isCancelled = intent.status === 'cancelled'
  const isPayable = intent.status === 'awaiting_payment'

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground antialiased selection:bg-primary/20">
      {/* Checkout Navbar */}
      <header className="border-b border-border/70 bg-card/40 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Link href="/">
            <BrandWordmark />
          </Link>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              <Lock className="size-3 text-primary" />
              Private Checkout
            </span>
          </div>
        </div>
      </header>

      {/* Main Checkout Surface */}
      <main className="flex-1 px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-lg space-y-6">
          {/* Card: Payment Requirement */}
          <div className="rounded-2xl border border-border/80 bg-card/60 p-6 sm:p-8 backdrop-blur-sm space-y-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  Payment Request
                </p>
                <p className="mt-0.5 font-mono text-xs text-foreground">
                  ID: <span className="text-muted-foreground">{intent.id}</span>
                </p>
              </div>
              <PaymentIntentStatusBadge status={intent.status} />
            </div>

            {/* Condition Banner */}
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-center">
              <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                Condition to Satisfy
              </p>
              <p className="mt-1 font-mono text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {describeAmountCondition(intent.conditions)}
              </p>
              {intent.conditions.reference && (
                <p className="mt-2 text-xs text-muted-foreground">
                  For: <span className="font-mono text-foreground font-medium">{intent.conditions.reference}</span>
                </p>
              )}
            </div>

            {/* Recipient Details */}
            <div className="space-y-3 pt-1 text-xs">
              <div className="flex items-start justify-between gap-3 border-b border-border/50 pb-2.5">
                <span className="text-muted-foreground">Merchant Account</span>
                <span className="font-mono text-foreground break-all text-right max-w-[240px]">
                  {intent.conditions.recipient}
                </span>
              </div>

              <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                <span className="text-muted-foreground">Network</span>
                <span className="font-mono text-foreground">
                  Midnight ({intent.network || midnightPublicConfig.network || 'testnet'})
                </span>
              </div>

              {intent.conditions.expiresAt && (
                <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                  <span className="text-muted-foreground">Expires</span>
                  <span className="font-mono text-foreground flex items-center gap-1">
                    <Clock className="size-3 text-muted-foreground" />
                    {new Date(intent.conditions.expiresAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

            {/* State Handling */}
            {isVerified ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 text-center text-xs text-emerald-300">
                <CheckCircle2 className="mx-auto size-6 text-emerald-400 mb-2" />
                <p className="font-semibold">Payment Already Verified</p>
                <p className="mt-1 text-[11px] text-emerald-400/90">
                  This payment intent has already been satisfied and confirmed on the protocol.
                </p>
              </div>
            ) : isExpired ? (
              <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-4 text-center text-xs text-zinc-300">
                <AlertTriangle className="mx-auto size-6 text-zinc-400 mb-2" />
                <p className="font-semibold">Payment Intent Expired</p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  The deadline for this payment intent has elapsed. Please request a new payment link from the merchant.
                </p>
              </div>
            ) : isCancelled ? (
              <div className="rounded-xl border border-border bg-muted/30 p-4 text-center text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Payment Cancelled</p>
                <p className="mt-1 text-[11px]">
                  The merchant cancelled this payment intent before fulfillment.
                </p>
              </div>
            ) : isPayable ? (
              /* Payer Action Area */
              <div className="space-y-4 pt-2">
                {connectedAddress ? (
                  <div className="rounded-xl border border-border/80 bg-background/60 p-3.5 text-xs space-y-1">
                    <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                      Payer Account
                    </p>
                    <p className="break-all font-mono text-foreground">{connectedAddress}</p>
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={handleConnectWallet}
                      disabled={isConnecting}
                      className="w-full inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Wallet className="size-4" />
                      {isConnecting ? 'Connecting Midnight Wallet...' : 'Connect Midnight Wallet to Pay'}
                    </button>
                    {walletError && (
                      <p className="mt-2 text-center text-[11px] text-amber-400 leading-relaxed">
                        {walletError}
                      </p>
                    )}
                  </div>
                )}

                {/* Honest Protocol State: Proving Key / Contract Integration Pending */}
                <div className="rounded-xl border border-border/80 bg-secondary/30 p-4 text-xs space-y-2">
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <Info className="size-4 text-primary shrink-0" />
                    <span>Midnight Proving Layer</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    In the live protocol, your wallet generates a zero-knowledge proof proving that you satisfied
                    the merchant condition without exposing your remaining balance or account history.
                  </p>
                  <button
                    type="button"
                    disabled
                    className="w-full mt-2 inline-flex h-9 items-center justify-center rounded-lg border border-border/60 bg-muted/40 text-xs font-mono text-muted-foreground opacity-60 cursor-not-allowed"
                  >
                    Submit Proof Payment (Midnight integration pending)
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Privacy Guarantee Card */}
          <div className="rounded-2xl border border-border/60 bg-card/30 p-5 space-y-2 text-xs leading-relaxed text-muted-foreground">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <ShieldCheck className="size-4 text-primary" />
              <span>Customer Privacy Protection</span>
            </div>
            <p>
              VeilPay ensures only the verification of your payment condition is revealed to the merchant.
              Your wallet address history, other assets, and broader financial transactions are never disclosed.
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
