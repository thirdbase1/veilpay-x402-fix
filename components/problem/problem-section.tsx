import { Section, SectionEyebrow, SectionHeading } from '@/components/site/section'
import { Reveal } from '@/components/site/reveal'
import { Pipeline } from '@/components/site/pipeline'

const exposedItems = [
  'Wallet addresses',
  'Transaction history',
  'Balances',
  'Payment relationships',
  'Publicly traceable activity',
]

export function ProblemSection() {
  return (
    <Section id="privacy">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Reveal>
            <SectionEyebrow>The problem</SectionEyebrow>
            <SectionHeading>Payments shouldn&apos;t require exposing everything.</SectionHeading>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
              Traditional crypto payments can expose far more than the transaction itself.
              A single payment often reveals:
            </p>
          </Reveal>
          <Reveal delay={140}>
            <ul className="mt-5 flex flex-col gap-2">
              {exposedItems.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/30 px-3 py-2.5 text-sm text-foreground"
                >
                  <span className="size-1.5 rounded-full bg-destructive/70" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-6 text-pretty leading-relaxed text-muted-foreground">
              Yet merchants often need only a simple answer:{' '}
              <span className="text-foreground">
                did this payment satisfy my requirements?
              </span>{' '}
              VeilPay is designed around that distinction.
            </p>
          </Reveal>
        </div>

        <div className="flex flex-col gap-6">
          <Reveal delay={120}>
            <div className="rounded-2xl border border-border/60 bg-card/40 p-5">
              <p className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Traditional verification
              </p>
              <Pipeline
                steps={[
                  { label: 'Payment', tone: 'neutral' },
                  { label: 'Address', tone: 'muted' },
                  { label: 'Transaction history', tone: 'muted' },
                  { label: 'Wallet activity', tone: 'muted' },
                  { label: 'Merchant', tone: 'neutral' },
                ]}
              />
              <p className="mt-4 text-xs text-muted-foreground">
                The merchant sees a chain of information they never needed.
              </p>
            </div>
          </Reveal>

          <Reveal delay={200}>
            <div className="rounded-2xl border border-primary/30 bg-primary/[0.06] p-5">
              <p className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-primary">
                VeilPay
              </p>
              <Pipeline
                steps={[
                  { label: 'Payment', tone: 'neutral' },
                  { label: 'Privacy-preserving verification', tone: 'primary' },
                  { label: 'Required result', tone: 'accent' },
                  { label: 'Merchant', tone: 'neutral' },
                ]}
              />
              <p className="mt-4 text-xs text-muted-foreground">
                Only the result the merchant needs crosses the boundary.
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
