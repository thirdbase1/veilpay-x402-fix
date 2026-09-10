import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Wordmark } from '@/components/site/brand'
import { routes } from '@/lib/config'

/** Minimal header for product routes (/app, /docs). */
export function AppHeader({ current }: { current: 'app' | 'docs' }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <div className="flex items-center gap-4">
          <Link
            href={routes.home}
            className="inline-flex items-center gap-1.5 rounded-md text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft className="size-4" />
            <span className="sr-only sm:not-sr-only">Home</span>
          </Link>
          <span aria-hidden="true" className="h-5 w-px bg-border" />
          <Link href={routes.home} aria-label="VeilPay home">
            <Wordmark />
          </Link>
        </div>
        <nav aria-label="Product" className="flex items-center gap-1">
          <Link
            href={routes.app}
            aria-current={current === 'app' ? 'page' : undefined}
            className="rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-foreground text-muted-foreground hover:text-foreground"
          >
            App
          </Link>
          <Link
            href={routes.docs}
            aria-current={current === 'docs' ? 'page' : undefined}
            className="rounded-md px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-foreground text-muted-foreground hover:text-foreground"
          >
            Docs
          </Link>
        </nav>
      </div>
    </header>
  )
}
