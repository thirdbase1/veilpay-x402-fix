import Link from 'next/link'
import { PlusCircle, ReceiptText } from 'lucide-react'

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-card/30 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl border border-border bg-background/80 text-muted-foreground shadow-sm">
        <ReceiptText className="size-6 text-muted-foreground/80" />
      </div>

      <h3 className="mt-4 text-sm font-semibold text-foreground">
        No invoices yet
      </h3>

      <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-muted-foreground">
        Create your first invoice to start accepting privately verifiable payments.
      </p>

      <Link
        href="/app/create"
        className="mt-6 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <PlusCircle className="size-3.5" />
        Create Payment
      </Link>
    </div>
  )
}
