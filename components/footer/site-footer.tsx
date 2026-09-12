import Link from 'next/link'
import { Code2 } from 'lucide-react'
import { Wordmark } from '@/components/site/brand'
import { routes, siteConfig } from '@/lib/config'

const productLinks = [
  { label: 'Product', href: '/#product' },
  { label: 'How It Works', href: '/#how-it-works' },
  { label: 'Privacy', href: '/#privacy' },
  { label: 'Developers', href: '/#developers' },
]

const resourceLinks = [
  { label: 'Public Explorer', href: routes.explorer },
  { label: 'Launch App', href: routes.app },
]

export function SiteFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Private payment infrastructure built on Midnight.
          </p>
          {(siteConfig.repoUrl || siteConfig.social.x) && (
            <div className="mt-5 flex items-center gap-2">
              {siteConfig.repoUrl && (
                <a
                  href={siteConfig.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Source repository"
                  className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Code2 className="size-4" />
                </a>
              )}
            </div>
          )}
        </div>

        <nav aria-label="Product" className="text-sm">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Product
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {productLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Resources" className="text-sm">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Resources
          </p>
          <ul className="mt-4 flex flex-col gap-3">
            {resourceLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            {siteConfig.repoUrl && (
              <li>
                <a
                  href={siteConfig.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  GitHub
                </a>
              </li>
            )}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-2 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:px-8">
          <p>&copy; {year} VeilPay. Private payment infrastructure built on Midnight.</p>
          <p>VeilPay is an independent project, not officially endorsed by Midnight.</p>
        </div>
      </div>
    </footer>
  )
}
