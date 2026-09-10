'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Menu, X, ArrowUpRight, User } from 'lucide-react'
import { Wordmark } from '@/components/site/brand'
import { cn } from '@/lib/utils'
import { primaryNav, utilityNav } from './nav-links'
import { createClient } from '@/lib/supabase/client'

export function SiteNav() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient()
        const {
          data: { session },
        } = await supabase.auth.getSession()
        setIsAuthenticated(!!session)
      } catch {
        setIsAuthenticated(false)
      }
    }
    checkAuth()
  }, [])

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        scrolled || open
          ? 'border-b border-border/70 bg-background/80 backdrop-blur-xl'
          : 'border-b border-transparent',
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8"
      >
        <Link
          href="/"
          className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="VeilPay home"
        >
          <Wordmark />
        </Link>

        <ul className="hidden items-center gap-1 md:flex">
          {primaryNav.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden items-center gap-2 md:flex">
          <Link
            href={utilityNav.docs.href}
            className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {utilityNav.docs.label}
          </Link>

          <Link
            href={utilityNav.sdk.href}
            className="rounded-md px-3 py-2 text-sm text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {utilityNav.sdk.label}
          </Link>

          {isAuthenticated ? (
            <Link
              href="/app"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>Merchant Console</span>
              <ArrowUpRight className="size-4" />
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/auth/signup"
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>Get Started</span>
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex size-10 items-center justify-center rounded-md border border-border text-foreground md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? 'Close menu' : 'Open menu'}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </nav>

      {open && (
        <div
          id="mobile-nav"
          className="border-t border-border/70 bg-background/95 px-5 pb-6 pt-2 backdrop-blur-xl md:hidden"
        >
          <ul className="flex flex-col">
            {primaryNav.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-3 text-base text-foreground/90 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href={utilityNav.docs.href}
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-md border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {utilityNav.docs.label}
            </Link>
            <Link
              href={utilityNav.sdk.href}
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {utilityNav.sdk.label}
            </Link>
            {isAuthenticated ? (
              <Link
                href="/app"
                onClick={() => setOpen(false)}
                className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span>Merchant Console</span>
                <ArrowUpRight className="size-4" />
              </Link>
            ) : (
              <div className="flex flex-col gap-2">
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center rounded-md border border-border px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                >
                  Sign in
                </Link>
                <Link
                  href="/auth/signup"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <span>Get Started</span>
                  <ArrowUpRight className="size-4" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
