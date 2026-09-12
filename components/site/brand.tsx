import { cn } from '@/lib/utils'

/**
 * VeilPay mark: a solid amber tile with dark redaction bars cutting across it —
 * concealment made visible. The redaction bar is the brand's signature motif.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex size-7 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-[0_6px_20px_-8px_oklch(0.8_0.15_78/0.7)]',
        className,
      )}
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-4">
        <path d="M3 9h18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        <path
          d="M3 15h11"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    </span>
  )
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <BrandMark />
      <span className="font-display text-[17px] font-semibold tracking-tight text-foreground">
        Veil<span className="text-primary">Pay</span>
      </span>
    </span>
  )
}

export const BrandWordmark = Wordmark
