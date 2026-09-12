'use client'

import Link from 'next/link'
import { PlusCircle, Menu } from 'lucide-react'
import { WalletButton } from './wallet-button'
import { MerchantUserMenu } from './merchant-user-menu'
import { NotificationPopover } from './notification-popover'
import { useDashboardNav } from './dashboard-layout'

interface DashboardHeaderProps {
  title: string
  description?: string
  action?: {
    href: string
    label: string
  } | null
  onOpenMobileMenu?: () => void
}

export function DashboardHeader({
  title,
  description = 'Create and monitor privacy-preserving payment intents.',
  action = { href: '/app/create', label: 'Create Payment' },
  onOpenMobileMenu,
}: DashboardHeaderProps) {
  const { openMobileMenu } = useDashboardNav()
  const handleOpen = onOpenMobileMenu || openMobileMenu

  const shortActionLabel = action?.label?.split(' ')[0] || 'Create'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-2 border-b border-border/50 bg-background/70 px-4 backdrop-blur-xl sm:px-8">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
      />

      <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={handleOpen}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:bg-muted/40 hover:text-foreground md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-4" />
        </button>

        <span
          aria-hidden="true"
          className="hidden h-4 w-1 shrink-0 rounded-full bg-primary sm:block"
        />
        <div className="min-w-0">
          <h1 className="truncate font-display text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {title}
          </h1>
          {description && (
            <p className="hidden truncate text-xs text-muted-foreground sm:block">{description}</p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <NotificationPopover />

        <WalletButton />

        <MerchantUserMenu />

        {action && (
          <Link
            href={action.href}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-[0_8px_24px_-10px_oklch(0.8_0.15_78/0.8)] transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:gap-2 sm:px-3.5"
          >
            <PlusCircle className="size-3.5" />
            <span className="hidden sm:inline">{action.label}</span>
            <span className="sm:hidden">{shortActionLabel}</span>
          </Link>
        )}
      </div>
    </header>
  )
}
