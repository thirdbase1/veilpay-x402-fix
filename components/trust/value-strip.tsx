import { ShieldCheck, FileCheck2, Layers } from 'lucide-react'
import { Section } from '@/components/site/section'
import { Reveal } from '@/components/site/reveal'

const values = [
  {
    icon: ShieldCheck,
    title: 'Privacy by Design',
    body: 'Only disclose what the payment requires.',
  },
  {
    icon: FileCheck2,
    title: 'Cryptographic Verification',
    body: 'Payment conditions can be verified rather than blindly trusted.',
  },
  {
    icon: Layers,
    title: 'Built on Midnight',
    body: "Designed around Midnight's privacy-preserving blockchain architecture.",
  },
]

export function ValueStrip() {
  return (
    <Section className="py-14 sm:py-16">
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {values.map((value, i) => {
          const Icon = value.icon
          return (
            <Reveal as="li" key={value.title} delay={i * 90}>
              <div className="flex h-full flex-col gap-3 rounded-xl border border-border/60 bg-card/40 p-5">
                <span className="flex size-9 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="text-sm font-semibold text-foreground">{value.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{value.body}</p>
              </div>
            </Reveal>
          )
        })}
      </ul>
    </Section>
  )
}
