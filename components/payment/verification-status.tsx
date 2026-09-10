import type { PaymentIntentStatus } from '@/lib/payments/types'
import { CheckCircle2, Clock, RefreshCw, XCircle, AlertTriangle, Ban } from 'lucide-react'

interface VerificationStatusFlowProps {
  status: PaymentIntentStatus
}

export function VerificationStatusFlow({ status }: VerificationStatusFlowProps) {
  const isTerminal = ['verified', 'expired', 'failed', 'cancelled'].includes(status)

  // Determine stage progression
  const steps = [
    {
      id: 'awaiting_payment',
      label: 'Awaiting Payment',
      desc: 'Customer opens checkout',
    },
    {
      id: 'verifying',
      label: 'ZK Verification',
      desc: 'Proof verification underway',
    },
    {
      id: 'verified',
      label: 'Verified',
      desc: 'Conditions satisfied',
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

  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Verification Pipeline
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {isTerminal ? 'Terminal state reached' : 'Monitoring protocol events'}
        </span>
      </div>

      {status === 'cancelled' && (
        <div className="rounded-xl border border-border/80 bg-muted/30 p-3.5 flex items-center gap-3 text-xs text-muted-foreground">
          <Ban className="size-4 shrink-0 text-muted-foreground" />
          <p>This payment intent was cancelled by the merchant before completion.</p>
        </div>
      )}

      {status === 'expired' && (
        <div className="rounded-xl border border-zinc-700/60 bg-zinc-900/40 p-3.5 flex items-center gap-3 text-xs text-zinc-300">
          <AlertTriangle className="size-4 shrink-0 text-zinc-400" />
          <p>This payment intent expired before satisfaction. Late customer payments will be rejected.</p>
        </div>
      )}

      {status === 'failed' && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-3.5 flex items-center gap-3 text-xs text-rose-300">
          <XCircle className="size-4 shrink-0 text-rose-400" />
          <p>Cryptographic proof verification failed to satisfy the required merchant conditions.</p>
        </div>
      )}

      {/* Pipeline Steps Stepper */}
      <div className="grid gap-3 sm:grid-cols-3 pt-2">
        {steps.map((step) => {
          const state = getStepState(step.id)

          return (
            <div
              key={step.id}
              className={`rounded-xl border p-4 transition ${
                state === 'completed'
                  ? 'border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                  : state === 'current'
                  ? 'border-cyan-500/40 bg-cyan-950/20 text-cyan-200'
                  : 'border-border/60 bg-background/40 text-muted-foreground'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  {step.id === 'awaiting_payment' ? 'Phase 1' : step.id === 'verifying' ? 'Phase 2' : 'Phase 3'}
                </span>
                {state === 'completed' ? (
                  <CheckCircle2 className="size-4 text-emerald-400" />
                ) : state === 'current' ? (
                  <RefreshCw className="size-4 animate-spin text-cyan-400" />
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
