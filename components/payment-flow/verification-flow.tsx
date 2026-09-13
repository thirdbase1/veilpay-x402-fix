'use client'

import { useEffect, useState } from 'react'
import { User, Lock, Boxes, Store, ArrowDown, Check } from 'lucide-react'
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

/** One sequencer tick per pipeline step; the last tick holds everything done. */
const STEP_MS = 1400
const TOTAL_STEPS = stages.length + 2

const HEX = '0123456789abcdef'

function randomGlyphs(count: number): string[] {
  return Array.from(
    { length: count },
    () => HEX[Math.floor(Math.random() * HEX.length)] + HEX[Math.floor(Math.random() * HEX.length)],
  )
}

/**
 * Sealed payment detail in transit: scrambled ciphertext that only resolves
 * at the end of the pipeline — the visual core of "nothing revealed".
 */
function CipherStream({ active }: { active: boolean }) {
  // Deterministic seed so server and client markup match; randomness only
  // starts after mount, once the stream is actually in transit.
  const [glyphs, setGlyphs] = useState<string[]>(['··', '··', '··'])

  useEffect(() => {
    if (!active) return
    setGlyphs(randomGlyphs(3))
    const id = window.setInterval(() => setGlyphs(randomGlyphs(3)), 90)
    return () => window.clearInterval(id)
  }, [active])

  return (
    <span
      className={cn(
        'cipher-stream font-mono text-[10px] tracking-[0.28em] text-primary transition-opacity duration-300',
        active ? 'opacity-100' : 'opacity-0',
      )}
      aria-hidden="true"
    >
      {glyphs.join(' ')}
    </span>
  )
}

export function VerificationFlow({ className }: { className?: string }) {
  const [step, setStep] = useState(0)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (reduced) return
    const id = window.setInterval(() => setStep((s) => (s + 1) % TOTAL_STEPS), STEP_MS)
    return () => window.clearInterval(id)
  }, [reduced])

  // In reduced-motion mode the pipeline renders fully verified, statically.
  const current = reduced ? TOTAL_STEPS - 1 : step

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
          const state = i < current ? 'done' : i === current ? 'active' : 'idle'
          const streaming = current === i
          return (
            <li key={stage.key} className="flex flex-col">
              <div
                className="flow-stage flex items-start gap-3 rounded-xl border border-border/60 bg-background/40 p-3"
                data-state={state}
              >
                <span
                  className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-lg border',
                    toneRing[stage.tone],
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{stage.title}</p>
                  <p className="text-xs text-muted-foreground">{stage.detail}</p>
                </div>
                {state === 'done' && (
                  <Check className="check-pop size-4 shrink-0 text-primary" aria-hidden="true" />
                )}
              </div>
              <span
                className="flow-arrow my-1 flex items-center justify-center gap-2"
                data-streaming={streaming}
                aria-hidden="true"
              >
                <CipherStream active={streaming} />
                <ArrowDown className="flow-arrow-icon size-4 text-muted-foreground/50" />
              </span>
            </li>
          )
        })}
      </ol>

      <div
        className="flow-result relative mt-3 flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 p-3"
        data-state={current > stages.length - 1 ? 'done' : current === stages.length - 1 + 1 ? 'active' : 'idle'}
      >
        <span className="flow-result-icon flex size-10 shrink-0 items-center justify-center rounded-lg border border-accent/40 bg-accent/15 text-accent">
          {/* Seal draws itself only once the proof arrives. */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5">
            <circle cx="12" cy="12" r="9" pathLength={1} className="draw-ring" aria-hidden="true" />
            <path d="M8.5 12.5l2.5 2.5 4.5-5" pathLength={1} className="draw-check" aria-hidden="true" />
          </svg>
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
