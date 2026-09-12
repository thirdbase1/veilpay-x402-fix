import { Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Section, SectionEyebrow, SectionHeading } from '@/components/site/section'
import { Reveal } from '@/components/site/reveal'
import { cn } from '@/lib/utils'

const cards = [
  {
    icon: Eye,
    tone: 'primary' as const,
    title: 'What the Merchant Needs',
    items: ['Invoice status', 'Required payment conditions', 'Verification result'],
  },
  {
    icon: EyeOff,
    tone: 'muted' as const,
    title: 'What Stays Private',
    items: ['Unnecessary wallet history', 'Unnecessary balances', 'Unnecessary payer information'],
  },
  {
    icon: ShieldCheck,
    tone: 'accent' as const,
    title: 'What VeilPay Proves',
    items: ['That the payment satisfies the defined conditions.'],
  },
]

const toneBorder = {
  primary: 'border-primary/30',
  muted: 'border-border/60',
  accent: 'border-accent/30',
}

const toneIcon = {
  primary: 'border-primary/30 bg-primary/10 text-primary',
  muted: 'border-border/60 bg-secondary/40 text-muted-foreground',
  accent: 'border-accent/30 bg-accent/10 text-accent',
}

export function PrivacySection() {
  return (
    <Section>
      <div className="max-w-3xl">
        <Reveal>
          <SectionEyebrow>Privacy Model</SectionEyebrow>
          <SectionHeading>Privacy isn&apos;t a feature. It&apos;s the architecture.</SectionHeading>
        </Reveal>
        <Reveal delay={80}>
          <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
            VeilPay is designed to minimize unnecessary disclosure. The exact guarantees
            depend on the implemented Midnight contract and application architecture — the
            model below describes the intent, not an absolute claim.
          </p>
        </Reveal>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((card, i) => {
          const Icon = card.icon
          return (
            <Reveal key={card.title} delay={i * 90}>
              <div
                className={cn(
                  'flex h-full flex-col gap-4 rounded-2xl border bg-card/40 p-6',
                  toneBorder[card.tone],
                )}
              >
                <span
                  className={cn(
                    'flex size-10 items-center justify-center rounded-lg border',
                    toneIcon[card.tone],
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-base font-semibold text-foreground">{card.title}</h3>
                <ul className="flex flex-col gap-2">
                  {card.items.map((item) => (
                    <li key={item} className="text-sm leading-relaxed text-muted-foreground">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          )
        })}
      </div>
    </Section>
  )
}
