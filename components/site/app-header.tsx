import Link from 'next/link'
import { ArrowLeft, Terminal, BookOpen, Layers } from 'lucide-react'
import { Wordmark } from '@/components/site/brand'
import { routes } from '@/lib/config'

/** Header for docs & SDK explorer routes (/docs, /docs/sdk). */
export function AppHeader({ current }: { current: 'app' | 'docs' | 'sdk' }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-8">
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
          <div className="hidden md:flex items-center gap-1.5 ml-2 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[11px] font-mono text-primary">
            <span>Midnight Preprod Ready</span>
          </div>
        </div>

        <nav aria-label="Product and Documentation" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/docs"
            aria-current={current === 'docs' ? 'page' : undefined}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-secondary aria-[current=page]:text-foreground text-muted-foreground hover:text-foreground"
          >
            <BookOpen className="size-3.5" />
            <span>Docs</span>
          </Link>

          <Link
            href="/docs/sdk"
            aria-current={current === 'sdk' ? 'page' : undefined}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-primary/20 aria-[current=page]:text-primary border border-primary/30 text-primary hover:bg-primary/15"
          >
            <Terminal className="size-3.5" />
            <span>SDK Explorer</span>
          </Link>

          <Link
            href={routes.app}
            aria-current={current === 'app' ? 'page' : undefined}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:text-foreground text-muted-foreground hover:text-foreground"
          >
            <Layers className="size-3.5" />
            <span>Merchant App</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}
