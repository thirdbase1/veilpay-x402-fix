'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BrandWordmark } from '@/components/site/brand'
import {
  LayoutDashboard,
  ReceiptText,
  Activity as ActivityIcon,
  PlusCircle,
  FileCode2,
  Settings,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react'
import { useWallet } from '@/lib/wallet/context'
import { midnightPublicConfig } from '@/lib/config'

interface SidebarProps {
  onNavigate?: () => void
}

export function DashboardSidebar({ onNavigate }: SidebarProps) {
  const pathname = usePathname()
  const { status, account } = useWallet()

  const mainNav = [
    { href: '/app', label: 'Overview', icon: LayoutDashboard },
    { href: '/app/intents', label: 'Payment Intents', icon: ReceiptText },
    { href: '/app/activity', label: 'Activity', icon: ActivityIcon },
    { href: '/app/create', label: 'Create Payment', icon: PlusCircle },
  ]

  const secondaryNav = [
    { href: '/docs', label: 'Documentation', icon: FileCode2 },
    { href: '/app/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border/70 bg-card/40 backdrop-blur-xl">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-border/60">
        <Link href="/" className="inline-flex items-center gap-2" onClick={onNavigate}>
          <BrandWordmark />
        </Link>
        <span className="rounded-md border border-primary/20 bg-primary/5 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
          Merchant
        </span>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          <p className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
            Control Center
          </p>
          {mainNav.map((item) => {
            const Icon = item.icon
            const isActive =
              item.href === '/app'
                ? pathname === '/app'
                : pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  isActive
                    ? 'bg-secondary text-foreground font-semibold shadow-inner'
                    : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                }`}
              >
                <Icon className={`size-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {item.label}
              </Link>
            )
          })}
        </div>

        <div className="mt-8 space-y-1">
          <p className="px-3 pb-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/70">
            Developer & Protocol
          </p>
          {secondaryNav.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition ${
                  isActive
                    ? 'bg-secondary text-foreground font-semibold'
                    : 'text-muted-foreground hover:bg-muted/30 hover:text-foreground'
                }`}
              >
                <Icon className={`size-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* Privacy Note */}
        <div className="mt-8 mx-2 rounded-xl border border-border/50 bg-background/50 p-3">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="size-4" />
            <p className="font-mono text-[11px] font-medium text-foreground">Zero-Knowledge Verification</p>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            Payments are verified against your conditions without revealing the customer&apos;s wallet balance or transaction history.
          </p>
        </div>
      </div>

      {/* Bottom Account / Protocol Area */}
      <div className="border-t border-border/60 p-4">
        <div className="rounded-xl border border-border/60 bg-card/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              Midnight Network
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[11px] text-foreground">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              {midnightPublicConfig.network}
            </span>
          </div>
          <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">Merchant Wallet</span>
            {status === 'connected' && account ? (
              <span className="font-mono text-emerald-400">
                {account.address.slice(0, 5)}...{account.address.slice(-3)}
              </span>
            ) : (
              <span className="text-muted-foreground/70 font-mono text-[10px]">Disconnected</span>
            )}
          </div>
        </div>
      </div>
    </aside>
  )
}
