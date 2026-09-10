import { ArrowUpRight } from 'lucide-react'
import { Section, SectionEyebrow, SectionHeading } from '@/components/site/section'
import { Reveal } from '@/components/site/reveal'
import { siteConfig } from '@/lib/config'

export function MidnightSection() {
  return (
    <Section>
      <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-card/40 p-8 sm:p-12">
        <div
          className="veil-grid pointer-events-none absolute inset-0 opacity-20 [mask-image:radial-gradient(60%_80%_at_80%_20%,black,transparent)]"
          aria-hidden="true"
        />
        <div className="relative max-w-2xl">
          <Reveal>
            <SectionEyebrow>Why Midnight</SectionEyebrow>
            <SectionHeading>Built for a world where privacy is programmable.</SectionHeading>
          </Reveal>
          <Reveal delay={80}>
            <p className="mt-5 text-pretty leading-relaxed text-muted-foreground">
              VeilPay uses Midnight&apos;s privacy-preserving blockchain architecture to move
              payment verification beyond the assumption that every piece of transaction
              information must be public.
            </p>
          </Reveal>
          <Reveal delay={140}>
            <a
              href={siteConfig.midnightUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 rounded-md border border-border bg-background/40 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Explore the Midnight network
              <ArrowUpRight className="size-4" />
            </a>
          </Reveal>
          <Reveal delay={180}>
            <p className="mt-4 text-xs text-muted-foreground">
              VeilPay is an independent project and is not officially endorsed by Midnight.
            </p>
          </Reveal>
        </div>
      </div>
    </Section>
  )
}
