import type { PaymentIntentStatus } from '@/lib/payments/types'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileCode2,
  RefreshCw,
  Ban,
} from 'lucide-react'

interface StatusBadgeProps {
  status: PaymentIntentStatus
  className?: string
}

export function PaymentIntentStatusBadge({ status, className = '' }: StatusBadgeProps) {
  switch (status) {
    case 'draft':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground ${className}`}
        >
          <FileCode2 className="size-3" />
          Draft
        </span>
      )

    case 'awaiting_payment':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-950/30 px-2.5 py-0.5 font-mono text-[11px] font-medium text-cyan-300 ${className}`}
        >
          <Clock className="size-3 text-cyan-400" />
          Awaiting Payment
        </span>
      )

    case 'verifying':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-950/30 px-2.5 py-0.5 font-mono text-[11px] font-medium text-amber-300 ${className}`}
        >
          <RefreshCw className="size-3 animate-spin text-amber-400" />
          Verifying
        </span>
      )

    case 'verified':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/30 px-2.5 py-0.5 font-mono text-[11px] font-medium text-emerald-300 ${className}`}
        >
          <CheckCircle2 className="size-3 text-emerald-400" />
          Verified
        </span>
      )

    case 'expired':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-zinc-700/60 bg-zinc-900/60 px-2.5 py-0.5 font-mono text-[11px] font-medium text-zinc-400 ${className}`}
        >
          <AlertTriangle className="size-3 text-zinc-400" />
          Expired
        </span>
      )

    case 'failed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-950/30 px-2.5 py-0.5 font-mono text-[11px] font-medium text-rose-300 ${className}`}
        >
          <XCircle className="size-3 text-rose-400" />
          Failed
        </span>
      )

    case 'cancelled':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground ${className}`}
        >
          <Ban className="size-3 text-muted-foreground" />
          Cancelled
        </span>
      )

    case 'refunded':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-950/30 px-2.5 py-0.5 font-mono text-[11px] font-medium text-violet-300 ${className}`}
        >
          <RefreshCw className="size-3 text-violet-400" />
          Refunded
        </span>
      )

    default:
      return (
        <span className="font-mono text-xs text-muted-foreground">
          {status}
        </span>
      )
  }
}
