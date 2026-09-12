'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
  AlertTriangle,
  Ban,
  PlusCircle,
  Copy,
  Check,
  ShieldCheck,
} from 'lucide-react'
import type { PaymentIntent } from '@/lib/payments/types'

interface VerificationCardProps {
  intent: PaymentIntent
}

export function VerificationCard({ intent }: VerificationCardProps) {
  const [copiedProof, setCopiedProof] = useState(false)
  const { status, onChainReference, updatedAt } = intent

  const isTerminal = ['verified', 'expired', 'failed', 'cancelled'].includes(status)

  const steps = [
    {
      id: 'awaiting_payment',
      label: 'Awaiting Payment',
      desc: 'Customer opens checkout',
    },
    {
      id: 'verifying',
      label: 'Verifying',
      desc: 'Zero-knowledge proof verification',
    },
    {
      id: 'verified',
      label: 'Verified',
      desc: 'Payment satisfies intent conditions',
    },
  ]

  const getStepState = (stepId: string) => {
    if (status === 'cancelled') return 'cancelled'
    if (status === 'expired') return 'expired'
    if (status === 'failed') return 'failed'

    if (status === 'verified') return 'completed'

    if (status === 'verifying') {
      if (stepId === 'awaiting_payment') return 'completed'
      if (stepId === 'verifying') return 'current'
      return 'upcoming'
    }

    if (status === 'awaiting_payment' || status === 'draft') {
      if (stepId === 'awaiting_payment') return 'current'
      return 'upcoming'
    }

    return 'upcoming'
  }

  const handleCopyProof = (ref: string) => {
    if (!navigator.clipboard) return
    navigator.clipboard.writeText(ref)
    setCopiedProof(true)
    setTimeout(() => setCopiedProof(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm space-y-5">
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Verification Status
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cryptographic proof lifecycle evaluated against intent conditions.
          </p>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          {isTerminal ? 'Terminal state' : 'Active protocol monitor'}
        </span>
      </div>

      {/* Verified Banner */}
      {status === 'verified' && (
        <div className="rounded-xl border border-accent/40 bg-accent/20 p-4 space-y-2 text-accent">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-accent" />
            <span className="text-xs font-semibold">Payment Verified</span>
          </div>
          <p className="text-xs text-accent/90 leading-relaxed">
            The payment satisfied the requirements defined by this intent. The merchant receives verified proof without exposing the customer&apos;s broader financial history.
          </p>
          {onChainReference && (
            <div className="pt-1 flex items-center justify-between text-[11px] font-mono border-t border-accent/20">
              <span className="text-accent">Proof Reference:</span>
              <div className="flex items-center gap-1.5">
                <code className="text-accent truncate max-w-[200px]">{onChainReference}</code>
                <button
                  type="button"
                  onClick={() => handleCopyProof(onChainReference)}
                  className="hover:text-accent"
                  aria-label="Copy proof reference"
                >
                  {copiedProof ? <Check className="size-3" /> : <Copy className="size-3" />}
                </button>
              </div>
            </div>
          )}
          {updatedAt && (
            <p className="text-[10px] text-accent/80 font-mono">
              Verified at: {new Date(updatedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}

      {/* Verifying Banner */}
      {status === 'verifying' && (
        <div className="rounded-xl border border-primary/40 bg-primary/20 p-4 space-y-2 text-primary">
          <div className="flex items-center gap-2">
            <RefreshCw className="size-4 animate-spin motion-reduce:animate-none text-primary" />
            <span className="text-xs font-semibold">Verifying Payment</span>
          </div>
          <p className="text-xs text-primary/90 leading-relaxed">
            Payment transaction detected on Midnight. Zero-knowledge contract rules are currently verifying that amount and recipient conditions are satisfied.
          </p>
        </div>
      )}

      {/* Awaiting Payment Banner */}
      {status === 'awaiting_payment' && (
        <div className="rounded-xl border border-border/70 bg-background/50 p-4 space-y-1.5 text-muted-foreground text-xs">
          <div className="flex items-center gap-2 text-foreground font-medium">
            <Clock className="size-3.5 text-primary" />
            <span>Awaiting Payment</span>
          </div>
          <p className="leading-relaxed">
            Waiting for the customer to open the checkout URL and submit a private transaction from their supported Midnight wallet.
          </p>
        </div>
      )}

      {/* Expired Banner with CTA */}
      {status === 'expired' && (
        <div className="rounded-xl border border-warning/30 bg-warning/20 p-4 space-y-3 text-warning">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-warning" />
            <span className="text-xs font-semibold">Payment Intent Expired</span>
          </div>
          <p className="text-xs text-warning/90 leading-relaxed">
            This intent is no longer accepting payments. The configured deadline has elapsed and protocol nodes will reject subsequent settlement proofs.
          </p>
          <div className="pt-1">
            <Link
              href="/app/create"
              className="inline-flex items-center gap-1.5 rounded-lg border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning hover:bg-warning/20 transition-colors"
            >
              <PlusCircle className="size-3.5" />
              Create New Payment Intent
            </Link>
          </div>
        </div>
      )}

      {/* Cancelled Banner */}
      {status === 'cancelled' && (
        <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-2 text-muted-foreground">
          <div className="flex items-center gap-2 text-foreground">
            <Ban className="size-4 text-destructive" />
            <span className="text-xs font-semibold">Payment Intent Cancelled</span>
          </div>
          <p className="text-xs leading-relaxed">
            This payment intent was cancelled by the merchant before completion. Customers can no longer submit payments against this identifier.
          </p>
        </div>
      )}

      {/* Failed Banner */}
      {status === 'failed' && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/20 p-4 space-y-2 text-destructive">
          <div className="flex items-center gap-2">
            <XCircle className="size-4 text-destructive" />
            <span className="text-xs font-semibold">Verification Failed</span>
          </div>
          <p className="text-xs text-destructive/90 leading-relaxed">
            The cryptographic proof failed to satisfy the configured payment conditions, or verification could not be completed on the network.
          </p>
        </div>
      )}

      {/* Lifecycle Stepper Grid */}
      <div className="grid gap-3 sm:grid-cols-3 pt-1">
        {steps.map((step) => {
          const state = getStepState(step.id)

          return (
            <div
              key={step.id}
              className={`rounded-xl border p-4 transition-colors ${
                state === 'completed'
                  ? 'border-accent/30 bg-accent/20 text-accent'
                  : state === 'current'
                  ? 'border-primary/40 bg-primary/20 text-primary'
                  : 'border-border/60 bg-background/40 text-muted-foreground'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {step.id === 'awaiting_payment' ? 'Phase 1' : step.id === 'verifying' ? 'Phase 2' : 'Phase 3'}
                </span>
                {state === 'completed' ? (
                  <CheckCircle2 className="size-4 text-accent" />
                ) : state === 'current' ? (
                  <RefreshCw className="size-4 animate-spin motion-reduce:animate-none text-primary" />
                ) : (
                  <Clock className="size-4 text-muted-foreground/50" />
                )}
              </div>

              <p className="mt-2 text-xs font-semibold text-foreground">
                {step.label}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {step.desc}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
