import Image from 'next/image'
import { cn } from '@/lib/utils'

/**
 * VeilPay mark: the official 3D "V" brand asset, with a slow diagonal
 * light sheen sweeping across the facets — the veil catching light.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-black ring-1 ring-white/10',
        className,
      )}
    >
      <Image src="/veilpay-logo.png" alt="" width={28} height={28} className="size-full object-cover" priority />
      <span className="veil-sheen pointer-events-none absolute inset-0" />
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
