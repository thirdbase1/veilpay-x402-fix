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
          className={`inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/30 px-2.5 py-0.5 font-mono text-[11px] font-medium text-primary ${className}`}
        >
          <Clock className="size-3 text-primary" />
          Awaiting Payment
        </span>
      )

    case 'verifying':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/30 px-2.5 py-0.5 font-mono text-[11px] font-medium text-warning ${className}`}
        >
          <RefreshCw className="size-3 animate-spin text-warning" />
          Verifying
        </span>
      )

    case 'verified':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/30 px-2.5 py-0.5 font-mono text-[11px] font-medium text-accent ${className}`}
        >
          <CheckCircle2 className="size-3 text-accent" />
          Verified
        </span>
      )

    case 'expired':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-2.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground ${className}`}
        >
          <AlertTriangle className="size-3 text-muted-foreground" />
          Expired
        </span>
      )

    case 'failed':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/30 px-2.5 py-0.5 font-mono text-[11px] font-medium text-destructive ${className}`}
        >
          <XCircle className="size-3 text-destructive" />
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
          className={`inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/30 px-2.5 py-0.5 font-mono text-[11px] font-medium text-primary ${className}`}
        >
          <RefreshCw className="size-3 text-primary" />
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
