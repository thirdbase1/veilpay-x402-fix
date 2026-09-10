'use client'

import Link from 'next/link'
import { PlusCircle, Menu } from 'lucide-react'
import { WalletButton } from './wallet-button'
import { useDashboardNav } from './dashboard-layout'

interface DashboardHeaderProps {
  title: string
  description?: string
  action?: {
    href: string
    label: string
  }
  onOpenMobileMenu?: () => void
}

export function DashboardHeader({
  title,
  description = 'Create and monitor privacy-preserving payment intents.',
  action = { href: '/app/create', label: 'Create payment' },
  onOpenMobileMenu,
}: DashboardHeaderProps) {
  const { openMobileMenu } = useDashboardNav()
  const handleOpen = onOpenMobileMenu || openMobileMenu

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/80 px-4 sm:px-8 backdrop-blur-xl gap-2">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted/40 hover:text-foreground md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-4" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-semibold tracking-tight text-foreground truncate">
            {title}
          </h1>
          {description && (
            <p className="hidden text-xs text-muted-foreground sm:block truncate">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        <WalletButton />

        {action && (
          <Link
            href={action.href}
            className="inline-flex h-9 items-center gap-1.5 sm:gap-2 rounded-lg bg-primary px-3 sm:px-3.5 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PlusCircle className="size-3.5" />
            <span className="hidden xs:inline sm:inline">{action.label}</span>
            <span className="xs:hidden sm:hidden inline">Create</span>
          </Link>
        )}
      </div>
    </header>
  )
}
