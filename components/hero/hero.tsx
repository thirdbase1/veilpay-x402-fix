import Link from 'next/link'
import { ArrowRight, BookOpen } from 'lucide-react'
import { VerificationFlow } from '@/components/payment-flow/verification-flow'
import { Reveal } from '@/components/site/reveal'
import { routes } from '@/lib/config'

export function Hero() {
  return (
    <section
      id="product"
      className="relative overflow-hidden scroll-mt-24 pt-28 sm:pt-36"
    >
      <div
        className="veil-grid pointer-events-none absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(70%_60%_at_50%_0%,black,transparent)]"
        aria-hidden="true"
      />
      <div className="veil-radial pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 gap-12 px-5 pb-20 sm:px-8 sm:pb-28 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/50 px-3 py-1 font-mono text-xs text-muted-foreground backdrop-blur-sm">
              <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
              Privacy-preserving payments on Midnight
            </span>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="mt-6 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Private payments.
              <br />
              <span className="text-primary">Public confidence.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              VeilPay lets merchants verify payments without exposing more customer
              information than necessary. Built with privacy-preserving technology on
              Midnight.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={routes.app}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Create a payment
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href={routes.docs}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card/40 px-5 py-3 text-sm font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <BookOpen className="size-4" />
                Explore the protocol
              </Link>
            </div>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <VerificationFlow />
        </Reveal>
      </div>
    </section>
  )
}
