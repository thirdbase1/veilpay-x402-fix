'use client'

import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardHeader } from '@/components/dashboard/header'
import { useWallet } from '@/lib/wallet/context'
import { midnightPublicConfig, isMidnightConfigured } from '@/lib/config'
import {
  Settings,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Globe,
  Wallet,
  Lock,
} from 'lucide-react'

export default function MerchantSettingsPage() {
  const { status, account } = useWallet()
  const midnightReady = isMidnightConfigured()

  return (
    <DashboardLayout>
      <DashboardHeader
        title="Settings & Network Configuration"
        description="Review protocol integration status, wallet connections, and environment parameters."
        action={{ href: '/app/create', label: 'Create payment' }}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6 max-w-4xl">
        <div className="flex items-center gap-2">
          <Settings className="size-4 text-primary" />
          <h1 className="text-base font-semibold text-foreground">
            Merchant Protocol Environment
          </h1>
        </div>

        {/* Midnight Network Configuration Card */}
        <div className="rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm space-y-5">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Globe className="size-4 text-primary" />
                Midnight Network
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target zero-knowledge blockchain environment.
              </p>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[11px] ${
                midnightReady
                  ? 'border border-emerald-500/30 bg-emerald-950/20 text-emerald-300'
                  : 'border border-amber-500/30 bg-amber-950/20 text-amber-300'
              }`}
            >
              <span className={`size-1.5 rounded-full ${midnightReady ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {midnightReady ? 'Ready' : 'Integration Pending'}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 text-xs">
            <div className="rounded-xl border border-border/60 bg-background/50 p-3.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Target Network
              </span>
              <p className="mt-1 font-mono text-xs font-semibold text-foreground">
                {midnightPublicConfig.network}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Configured via NEXT_PUBLIC_MIDNIGHT_NETWORK
              </p>
            </div>

            <div className="rounded-xl border border-border/60 bg-background/50 p-3.5">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Contract Address
              </span>
              <p className="mt-1 font-mono text-xs font-semibold text-foreground break-all">
                {midnightPublicConfig.contractAddress || 'Not deployed / Unset'}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Configured via NEXT_PUBLIC_MIDNIGHT_CONTRACT_ADDRESS
              </p>
            </div>
          </div>
        </div>

        {/* Merchant Wallet Card */}
        <div className="rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Wallet className="size-4 text-primary" />
                Merchant Signing Wallet
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Active wallet connection for intent creation and condition settlement.
              </p>
            </div>

            <span className="font-mono text-xs text-muted-foreground">
              Status: <strong className="text-foreground capitalize">{status}</strong>
            </span>
          </div>

          {account ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/10 p-4 text-xs space-y-2">
              <div className="flex items-center gap-2 text-emerald-300 font-medium">
                <CheckCircle2 className="size-4" />
                <span>Wallet Connected</span>
              </div>
              <p className="break-all font-mono text-foreground text-xs">{account.address}</p>
              <p className="text-[11px] text-muted-foreground">Network: {account.network}</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border/80 bg-background/50 p-4 text-xs space-y-2 text-muted-foreground">
              <p>No merchant wallet is connected. You can still create intent drafts and specify destination addresses manually.</p>
            </div>
          )}
        </div>

        {/* Privacy Architecture Checklist */}
        <div className="rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm space-y-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" />
            VeilPay Protocol Privacy Architecture
          </h2>

          <div className="space-y-2.5 text-xs text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <Lock className="size-3.5 text-primary shrink-0 mt-0.5" />
              <p>
                <strong className="text-foreground font-medium">Zero-Knowledge Verification:</strong> Customer payments prove condition satisfaction to the merchant without revealing the customer&apos;s wallet balance or transaction history.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Lock className="size-3.5 text-primary shrink-0 mt-0.5" />
              <p>
                <strong className="text-foreground font-medium">Server Isolation:</strong> Private keys, seeds, and signing secrets are never handled by the frontend. Transactions are signed inside the merchant or customer wallet extension.
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <Lock className="size-3.5 text-primary shrink-0 mt-0.5" />
              <p>
                <strong className="text-foreground font-medium">Honest Integration Boundary:</strong> The dashboard communicates through typed interfaces with zero simulated transactions or fake blockchain activity.
              </p>
            </div>
          </div>
        </div>
      </main>
    </DashboardLayout>
  )
}
