import { FileText, Wallet, ScanLine, BadgeCheck } from 'lucide-react'
import { Section, SectionEyebrow, SectionHeading } from '@/components/site/section'
import { Reveal } from '@/components/site/reveal'

const steps = [
  {
    num: '01',
    icon: FileText,
    title: 'Merchant Creates an Intent',
    body: 'The merchant specifies the payment requirements — such as a required amount, recipient, expiration, or other verifiable conditions.',
  },
  {
    num: '02',
    icon: Wallet,
    title: 'Customer Pays Privately',
    body: 'The customer connects their supported wallet and completes the payment. Private information stays protected wherever the protocol permits.',
  },
  {
    num: '03',
    icon: ScanLine,
    title: 'VeilPay Verifies Cryptographically',
    body: 'The protocol uses cryptographic (zero-knowledge) verification to check that the payment satisfies the payment intent.',
  },
  {
    num: '04',
    icon: BadgeCheck,
    title: 'Merchant Receives Proof',
    body: 'The merchant gets the information they actually need — payment verified — without unnecessary access to the customer\u2019s broader financial history.',
  },
]

export function HowItWorks() {
  return (
    <Section id="how-it-works">
      <Reveal>
        <SectionEyebrow>How It Works</SectionEyebrow>
        <SectionHeading>From payment intent to verified payment.</SectionHeading>
      </Reveal>

      <ol className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {steps.map((step, i) => {
          const Icon = step.icon
          return (
            <Reveal as="li" key={step.num} delay={i * 90}>
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-border/60 bg-card/40 p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-sm text-muted-foreground">{step.num}</span>
                </div>
                <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
            </Reveal>
          )
        })}
      </ol>
    </Section>
  )
}
