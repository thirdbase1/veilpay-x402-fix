import Link from 'next/link'
import type { PaymentIntent } from '@/lib/payments/types'
import { describeAmountCondition } from '@/lib/payments/intent'
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Tag,
} from 'lucide-react'

export function CheckoutNotFound({ intentId }: { intentId: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card/60 p-6 sm:p-8 space-y-4 shadow-xl">
        <div className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 border border-destructive/20 text-destructive mx-auto">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </div>

        <div className="space-y-1">
          <h2 className="text-base font-semibold text-foreground">
            Invoice Not Found
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            The requested invoice ID{' '}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground font-medium">
              {intentId}
            </code>{' '}
            could not be resolved from the VeilPay protocol registry.
          </p>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Please check the URL or ask the merchant to generate a new payment link.
        </p>

        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border px-4 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <span>Return to VeilPay Home</span>
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  )
}

export function CheckoutExpired({ intent }: { intent: PaymentIntent }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-muted/40 p-6 sm:p-8 text-center space-y-4 shadow-xl">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground mx-auto">
        <Clock className="size-6" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          Payment Request Expired
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
          The deadline for satisfying this invoice elapsed on{' '}
          <span className="font-mono text-foreground">
            {intent.conditions.expiresAt
              ? new Date(intent.conditions.expiresAt).toLocaleString()
              : 'the protocol expiration time'}
          </span>
          .
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 text-xs text-muted-foreground space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-wider">Expired Condition</p>
        <p className="font-mono text-sm font-semibold text-foreground">
          {describeAmountCondition(intent.conditions)}
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground">
        Funds cannot be accepted for an expired intent. Please request a new payment link from the merchant.
      </p>
    </div>
  )
}

export function CheckoutCancelled({ intent }: { intent: PaymentIntent }) {
  return (
    <div className="rounded-2xl border border-border bg-card/40 p-6 sm:p-8 text-center space-y-4 shadow-xl">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted border border-border text-muted-foreground mx-auto">
        <XCircle className="size-6" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">
          Invoice Cancelled
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
          This invoice was cancelled by the merchant prior to fulfillment.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 text-xs text-muted-foreground space-y-1">
        <p className="font-mono text-[10px] uppercase tracking-wider">Cancelled Intent</p>
        <p className="font-mono text-xs text-foreground font-medium">{intent.id}</p>
      </div>

      <p className="text-[11px] text-muted-foreground">
        No funds were transferred. Contact the merchant if you believe this was in error.
      </p>
    </div>
  )
}

export function CheckoutVerifiedReceipt({ intent }: { intent: PaymentIntent }) {
  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/20 p-6 sm:p-8 text-center space-y-5 shadow-xl">
      <div className="flex size-12 items-center justify-center rounded-xl bg-accent/10 border border-accent/20 text-accent mx-auto">
        <CheckCircle2 className="size-7" aria-hidden="true" />
      </div>

      <div className="space-y-1">
        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-accent bg-accent/40 border border-accent/30 rounded-full px-2.5 py-0.5">
          <ShieldCheck className="size-3" aria-hidden="true" />
          Zero-Knowledge Verified
        </span>
        <h2 className="text-lg font-semibold text-foreground">
          Payment Successfully Satisfied
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm mx-auto">
          The payment condition has been cryptographically confirmed on the Midnight network.
          The merchant has received proof of payment.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/70 p-4 space-y-2.5 text-left text-xs">
        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <span className="text-muted-foreground">Condition Satisfied</span>
          <span className="font-mono font-semibold text-foreground">
            {describeAmountCondition(intent.conditions)}
          </span>
        </div>

        <div className="flex items-center justify-between border-b border-border/40 pb-2">
          <span className="text-muted-foreground">Recipient</span>
          <span className="font-mono text-foreground truncate max-w-[180px] sm:max-w-xs">
            {intent.conditions.recipient}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Intent ID</span>
          <span className="font-mono text-muted-foreground truncate max-w-[180px] sm:max-w-xs">
            {intent.id}
          </span>
        </div>

        {intent.conditions.reference && (
          <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1">
              <Tag className="size-3 text-primary" aria-hidden="true" />
              Reference
            </span>
            <span className="font-mono text-foreground font-medium">
              {intent.conditions.reference}
            </span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        You may safely close this window. Your financial history was not exposed.
      </p>
    </div>
  )
}
