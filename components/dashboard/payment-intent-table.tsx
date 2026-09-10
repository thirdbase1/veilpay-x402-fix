'use client'

import Link from 'next/link'
import type { PaymentIntent } from '@/lib/payments/types'
import { PaymentIntentStatusBadge } from './payment-intent-status'
import { describeAmountCondition } from '@/lib/payments/intent'
import { ArrowUpRight } from 'lucide-react'

interface PaymentIntentTableProps {
  intents: PaymentIntent[]
  isLoading?: boolean
}

export function PaymentIntentTable({ intents, isLoading = false }: PaymentIntentTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 w-full animate-pulse rounded-lg bg-muted/30" />
        ))}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border/70 bg-muted/20 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" className="px-5 py-3.5 font-medium">Status</th>
            <th scope="col" className="px-5 py-3.5 font-medium">Intent ID</th>
            <th scope="col" className="px-5 py-3.5 font-medium">Requirement</th>
            <th scope="col" className="px-5 py-3.5 font-medium">Created</th>
            <th scope="col" className="px-5 py-3.5 font-medium">Expires</th>
            <th scope="col" className="px-5 py-3.5 text-right font-medium">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50 font-mono">
          {intents.map((intent) => {
            const formattedDate = new Date(intent.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
            const formattedExpiry = intent.conditions.expiresAt
              ? new Date(intent.conditions.expiresAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : 'Never'

            return (
              <tr
                key={intent.id}
                className="group transition hover:bg-card/60"
              >
                <td className="whitespace-nowrap px-5 py-3.5">
                  <PaymentIntentStatusBadge status={intent.status} />
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-foreground">
                  <Link
                    href={`/app/intents/${intent.id}`}
                    className="hover:underline flex items-center gap-1.5 text-foreground"
                  >
                    <span>{intent.id}</span>
                    {intent.conditions.reference && (
                      <span className="font-sans text-[11px] font-normal text-muted-foreground">
                        ({intent.conditions.reference})
                      </span>
                    )}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-foreground font-sans">
                  {describeAmountCondition(intent.conditions)}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground font-sans">
                  {formattedDate}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-muted-foreground font-sans">
                  {formattedExpiry}
                </td>
                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                  <Link
                    href={`/app/intents/${intent.id}`}
                    className="inline-flex items-center gap-1 rounded-md border border-border/80 px-2.5 py-1 text-[11px] font-sans font-medium text-foreground transition hover:border-border hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span>Manage</span>
                    <ArrowUpRight className="size-3" />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
