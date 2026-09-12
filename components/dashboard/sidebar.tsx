'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { BrandWordmark } from '@/components/site/brand'
import {
  LayoutDashboard,
  ReceiptText,
  Activity as ActivityIcon,
  PlusCircle,
} from 'lucide-react'
import { useWallet } from '@/lib/wallet/context'
import { midnightPublicConfig } from '@/lib/config'
import { cn } from '@/lib/utils'

interface SidebarProps {
  onNavigate?: () => void
}

export function DashboardSidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const { status, account } = useWallet()

  const mainNav = [
    { href: '/app', label: 'Overview', icon: LayoutDashboard },
    { href: '/app/intents', label: 'Invoices', icon: ReceiptText },
    { href: '/app/activity', label: 'Activity', icon: ActivityIcon },
    { href: '/app/create', label: 'Create Payment', icon: PlusCircle },
  ]

  return (
    <aside className="flex h-full w-56 flex-col border-r border-border/60 bg-card/40">
      {/* Brand Header */}
      <div className="flex h-14 items-center justify-between border-b border-border/50 px-4">
        <Link href="/" className="inline-flex items-center gap-2" onClick={onNavigate}>
          <BrandWordmark />
        </Link>
        <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-primary">
          Merchant
        </span>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-5">
        <p className="px-3 pb-2.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">
          Control Center
        </p>
        <nav className="space-y-0.5">
          {mainNav.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/app' ? pathname === '/app' : pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  'group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition',
                  isActive
                    ? 'bg-primary/10 text-foreground'
                    : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary" />
                )}
                <Icon
                  className={cn(
                    'size-4',
                    isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground',
                  )}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Bottom Network Status */}
      <div className="border-t border-border/50 p-3">
        <div className="rounded-lg border border-border/50 bg-card/50 p-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <Image
                src="/midnight-mark.png"
                alt=""
                aria-hidden="true"
                width={14}
                height={14}
                className="size-3.5 rounded-full ring-1 ring-white/10"
              />
              Midnight
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-foreground">
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
              </span>
              {midnightPublicConfig.network}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2.5 text-[11px]">
            <span className="text-muted-foreground">Merchant Wallet</span>
            {status === 'connected' && account ? (
              <span className="font-mono text-accent">
                {account.address.slice(0, 5)}…{account.address.slice(-3)}
              </span>
            ) : (
              <span className="font-mono text-[10px] text-muted-foreground/70">Disconnected</span>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
