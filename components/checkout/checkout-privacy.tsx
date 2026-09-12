import { Shield, EyeOff, CheckCircle2, Lock } from 'lucide-react'

export function CheckoutPrivacy() {
  return (
    <section
      aria-labelledby="privacy-heading"
      className="rounded-2xl border border-border/80 bg-card/30 p-5 sm:p-6 backdrop-blur-sm space-y-4"
    >
      <div className="flex items-center gap-2">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 text-primary">
          <Shield className="size-3.5" aria-hidden="true" />
        </div>
        <div>
          <h2 id="privacy-heading" className="text-xs font-semibold text-foreground">
            Privacy Preservation Model
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Pay privately. Share only what the payment requires.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
        {/* Step 1: Customer */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Lock className="size-3 text-primary" aria-hidden="true" />
            <span>What you provide</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Payment authorization through your Midnight wallet for the required condition.
          </p>
        </div>

        {/* Step 2: Protocol / ZK */}
        <div className="rounded-xl border border-primary/25 bg-primary/5 p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
            <EyeOff className="size-3" aria-hidden="true" />
            <span>What Midnight proves</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Zero-knowledge proof confirming the payment condition is satisfied without revealing wallet history.
          </p>
        </div>

        {/* Step 3: Merchant */}
        <div className="rounded-xl border border-border/60 bg-background/50 p-3.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-accent">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            <span>What merchant gets</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Cryptographic confirmation only: payment condition satisfied. No access to broader financial accounts.
          </p>
        </div>
      </div>

      <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground leading-relaxed">
        <span className="font-semibold text-foreground/80">Privacy note: </span>
        VeilPay is engineered to minimize unnecessary financial disclosure. The exact privacy guarantees
        are enforced cryptographically by the underlying Midnight network contract.
      </div>
    </section>
  )
}
