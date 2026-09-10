import type { Metadata } from 'next'
import { AppHeader } from '@/components/site/app-header'
import { IntentBuilder } from '@/components/merchant/intent-builder'
import { isMidnightConfigured, midnightPublicConfig } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Merchant Dashboard',
  description:
    'Create a VeilPay payment intent by defining the conditions a payment must satisfy.',
  robots: { index: false },
}

export default function MerchantAppPage() {
  const midnightReady = isMidnightConfigured()

  return (
    <>
      <AppHeader current="app" />
      <main id="main" className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Payment intent builder
            </h1>
            <span
              className={
                midnightReady
                  ? 'inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-accent'
                  : 'inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/40 px-2.5 py-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground'
              }
            >
              <span
                className={
                  midnightReady
                    ? 'size-1.5 rounded-full bg-accent'
                    : 'size-1.5 rounded-full bg-muted-foreground'
                }
                aria-hidden="true"
              />
              {midnightReady
                ? `Midnight: ${midnightPublicConfig.network}`
                : 'Midnight: not configured'}
            </span>
          </div>
          <p className="max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Define the conditions a payment must satisfy. VeilPay builds a typed payment intent
            that can be handed to the Midnight verification layer — no payer identity, balance,
            or history is ever part of this structure.
          </p>
        </div>

        <div className="mt-10">
          <IntentBuilder />
        </div>
      </main>
    </>
  )
}
