import Link from 'next/link'
import { BrandWordmark } from '@/components/site/brand'
import { Lock, ShieldCheck } from 'lucide-react'
import { midnightPublicConfig } from '@/lib/config'

interface CheckoutHeaderProps {
  network?: string
}

export function CheckoutHeader({ network }: CheckoutHeaderProps) {
  const displayNetwork = network || midnightPublicConfig.network || 'testnet'

  return (
    <header className="border-b border-border/70 bg-card/40 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <BrandWordmark />
        </Link>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
            <Lock className="size-3 text-primary" aria-hidden="true" />
            <span className="font-medium text-foreground">Private Checkout</span>
          </div>

          <div className="hidden sm:inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 font-mono text-[10px] text-primary">
            <ShieldCheck className="size-3" aria-hidden="true" />
            <span>Midnight {displayNetwork}</span>
          </div>
        </div>
      </div>
    </header>
  )
}
