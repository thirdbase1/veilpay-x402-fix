'use client'

import { DashboardLayout } from '@/components/dashboard/dashboard-layout'
import { DashboardHeader } from '@/components/dashboard/header'
import { PaymentIntentForm } from '@/components/payment/payment-intent-form'
import Link from 'next/link'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

export default function CreatePaymentIntentPage() {
  return (
    <DashboardLayout>
      <DashboardHeader
        title="Create Payment Intent"
        description="Define conditions for a privacy-preserving payment on Midnight."
        action={{ href: '/app', label: 'View all intents' }}
      />

      <main className="flex-1 overflow-y-auto p-4 sm:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href="/app"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Back to overview
          </Link>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-2.5 py-0.5 font-mono text-[11px] text-primary">
              <ShieldCheck className="size-3" />
              Midnight-ready
            </span>
          </div>
        </div>

        <div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
            Create a New Payment Intent
          </h1>
          <p className="mt-1 text-xs text-muted-foreground max-w-xl">
            Configure the required asset amount, destination recipient, and optional deadline.
            Once created, a shareable payment checkout URL and QR code will be generated.
          </p>
        </div>

        <div className="pt-2">
          <PaymentIntentForm />
        </div>
      </main>
    </DashboardLayout>
  )
}
