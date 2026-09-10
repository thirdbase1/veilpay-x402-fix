import { cn } from '@/lib/utils'

/**
 * VeilPay wordmark. The mark is a minimal "veil" motif — two offset apertures
 * that only partially reveal — rendered as inline SVG (decorative, not an
 * illustration). No stock imagery, no lock/shield cliché.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-md border border-primary/40 bg-primary/10',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-4">
        <path
          d="M4 6.5C4 6.5 7 12 12 12C17 12 20 6.5 20 6.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="text-primary"
        />
        <path
          d="M4 12.5C4 12.5 7 18 12 18C17 18 20 12.5 20 12.5"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="text-primary/50"
        />
      </svg>
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <BrandMark />
      <span className="font-mono text-base font-semibold tracking-tight text-foreground">
        Veil<span className="text-primary">Pay</span>
      </span>
    </span>
  )
}
