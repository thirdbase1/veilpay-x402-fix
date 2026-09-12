import Link from 'next/link'
import { ArrowRight, Code2 } from 'lucide-react'
import { Reveal } from '@/components/site/reveal'
import { routes, siteConfig } from '@/lib/config'

export function FinalCta() {
  return (
    <section className="border-t border-border/60 py-24 sm:py-32">
      <div className="relative mx-auto w-full max-w-4xl px-5 text-center sm:px-8">
        <div
          className="veil-radial pointer-events-none absolute inset-0 -z-10"
          aria-hidden="true"
        />
        <Reveal>
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-5xl">
            Make payment verification private by default.
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <p className="mx-auto mt-5 max-w-2xl text-pretty leading-relaxed text-muted-foreground">
            Create a invoice, let the customer pay, and verify only what needs to be
            known.
          </p>
        </Reveal>
        <Reveal delay={140}>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={routes.app}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-auto"
            >
              Launch VeilPay
              <ArrowRight className="size-4" />
            </Link>
            {siteConfig.repoUrl && (
              <a
                href={siteConfig.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card/40 px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-auto"
              >
                <Code2 className="size-4" />
                View source
              </a>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
