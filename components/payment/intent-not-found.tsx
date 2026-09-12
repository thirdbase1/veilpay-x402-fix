import Link from 'next/link'
import { AlertTriangle, ArrowLeft } from 'lucide-react'

interface IntentNotFoundProps {
  id: string
  error?: string | null
}

export function IntentNotFound({ id, error }: IntentNotFoundProps) {
  return (
    <div className="max-w-2xl mx-auto py-12 px-4 space-y-6">
      <Link
        href="/app/intents"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" />
        Back to Payment Intents
      </Link>

      <div
        role="alert"
        className="rounded-2xl border border-destructive/30 bg-destructive/20 p-6 text-destructive space-y-4"
      >
        <div className="flex items-center gap-2.5 text-base font-semibold text-destructive">
          <AlertTriangle className="size-5 text-destructive" />
          <span>Payment Intent Not Found</span>
        </div>
        <p className="text-xs text-destructive/90 leading-relaxed">
          {error || "We couldn't find a payment intent with this identifier."}
        </p>
        <p className="font-mono text-xs text-destructive/70 break-all select-all">
          Requested ID: {id}
        </p>
        <div className="pt-2">
          <Link
            href="/app/intents"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Back to Payment Intents
          </Link>
        </div>
      </div>
    </div>
  )
}
