import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Section, SectionEyebrow, SectionHeading } from '@/components/site/section'
import { Reveal } from '@/components/site/reveal'
import { Pipeline } from '@/components/site/pipeline'
import { routes } from '@/lib/config'

export function DevelopersSection() {
  return (
    <Section id="developers">
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <Reveal>
            <SectionEyebrow>For Developers</SectionEyebrow>
            <SectionHeading>Build private payment experiences on top of VeilPay.</SectionHeading>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
              VeilPay is being designed with developer integration in mind — a typed payment
              intent model and a clean boundary to the Midnight verification layer, so your
              application can request exactly the verification it needs.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <Link
              href={routes.docs}
              className="mt-8 inline-flex items-center gap-2 rounded-md border border-border bg-card/40 px-5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Read the documentation
              <ArrowRight className="size-4" />
            </Link>
          </Reveal>
        </div>

        <Reveal delay={120}>
          <div className="rounded-2xl border border-border/60 bg-card/40 p-6">
            <p className="mb-4 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
              Conceptual Integration
            </p>
            <Pipeline
              className="sm:flex-col sm:items-stretch"
              steps={[
                { label: 'Merchant Application', tone: 'neutral' },
                { label: 'VeilPay Payment Intent', tone: 'primary' },
                { label: 'Midnight', tone: 'primary' },
                { label: 'Verification', tone: 'accent' },
              ]}
            />
            <p className="mt-4 text-xs text-muted-foreground">
              The application depends only on the typed VeilPay boundary — the Midnight
              verification layer is swapped in behind it.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  )
}
