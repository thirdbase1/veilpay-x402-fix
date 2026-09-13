'use client'

import { User, Lock, Boxes, Store, BadgeCheck, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import './verification-flow.css'

interface Stage {
  key: string
  title: string
  detail: string
  icon: typeof User
  tone: 'neutral' | 'private' | 'verify' | 'verified'
}

/**
 * Conceptual representation of the VeilPay verification pipeline.
 *
 * This is an architecture diagram, not live data. It shows how payment detail
 * stays sealed while only a verification result crosses to the merchant. No
 * amounts, addresses, hashes, or timestamps are shown because none are real.
 */
const stages: Stage[] = [
  {
    key: 'customer',
    title: 'Customer',
    detail: 'Initiates a payment against a merchant intent.',
    icon: User,
    tone: 'neutral',
  },
  {
    key: 'private',
    title: 'Private Payment',
    detail: 'Payment details are sealed to the payer.',
    icon: Lock,
    tone: 'private',
  },
  {
    key: 'zk',
    title: 'ZK Verification',
    detail: 'Conditions are checked without revealing the details.',
    icon: Boxes,
    tone: 'verify',
  },
  {
    key: 'merchant',
    title: 'Merchant',
    detail: 'Receives only the result they require.',
    icon: Store,
    tone: 'neutral',
  },
]

const toneRing: Record<Stage['tone'], string> = {
  neutral: 'border-border bg-secondary/50 text-foreground',
  private: 'border-primary/40 bg-primary/10 text-primary',
  verify: 'border-primary/40 bg-primary/10 text-primary',
  verified: 'border-accent/40 bg-accent/10 text-accent',
}

export function VerificationFlow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'verification-flow relative overflow-hidden rounded-2xl border border-border/70 bg-card/60 p-5 backdrop-blur-sm sm:p-6',
        className,
      )}
      role="img"
      aria-label="Conceptual VeilPay flow: a customer makes a private payment, zero-knowledge verification checks the merchant's conditions, and the merchant receives only a verified result."
    >
      <div className="veil-radial pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Verification flow
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
          Conceptual
        </span>
      </div>

      <ol className="relative mt-5 flex flex-col gap-3">
        {stages.map((stage, i) => {
          const Icon = stage.icon
          return (
            <li key={stage.key} className="flex flex-col">
              <div className="flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-3">
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg border',
                    toneRing[stage.tone],
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{stage.title}</p>
                  <p className="text-xs text-muted-foreground">{stage.detail}</p>
                </div>
              </div>
              {i < stages.length - 1 && (
                <span className="my-1 flex justify-center" aria-hidden="true">
                  <ArrowDown className="size-4 animate-pulse text-primary/60 motion-reduce:animate-none" />
                </span>
              )}
            </li>
          )
        })}
      </ol>

      <div className="relative mt-3 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-accent/40 bg-accent/15 text-accent">
          <BadgeCheck className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Verified</p>
          <p className="text-xs text-muted-foreground">
            Payment satisfies the intent — nothing more disclosed.
          </p>
        </div>
      </div>
    </div>
  )
}
