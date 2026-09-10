import Link from 'next/link'
import { ArrowRight, Link2, QrCode, Clock, BadgeCheck } from 'lucide-react'
import { Section, SectionEyebrow, SectionHeading } from '@/components/site/section'
import { Reveal } from '@/components/site/reveal'
import { routes } from '@/lib/config'

const flow = [
  { icon: Link2, label: 'Create Intent', body: 'Define the required conditions.' },
  { icon: QrCode, label: 'Share Link or QR', body: 'Hand the customer a payment target.' },
  { icon: Clock, label: 'Wait for Verification', body: 'The protocol checks the conditions.' },
  { icon: BadgeCheck, label: 'Receive Verified Status', body: 'Reconcile against your reference.' },
]

export function MerchantSection() {
  return (
    <Section>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <Reveal>
            <SectionEyebrow>For Merchants</SectionEyebrow>
            <SectionHeading>A payment flow merchants can actually use.</SectionHeading>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
              Create a payment intent, share it with your customer, and receive a verified
              status you can reconcile against your own order reference — without handling the
              customer&apos;s broader financial data.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <Link
              href={routes.app}
              className="mt-8 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Open Merchant Dashboard
              <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {flow.map((step, i) => {
              const Icon = step.icon
              return (
                <li
                  key={step.label}
                  className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-5"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{step.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {step.body}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </Reveal>
      </div>
    </Section>
  )
}
