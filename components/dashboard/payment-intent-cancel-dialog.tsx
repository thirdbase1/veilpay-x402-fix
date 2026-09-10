'use client'

import { useState } from 'react'
import type { PaymentIntent } from '@/lib/payments/types'
import { cancelPaymentIntentApi } from '@/lib/payments/service'
import { describeAmountCondition } from '@/lib/payments/intent'
import { Ban, AlertTriangle, Loader2, X } from 'lucide-react'

interface PaymentIntentCancelDialogProps {
  intent: PaymentIntent | null
  isOpen: boolean
  onClose: () => void
  onSuccess: (updated: PaymentIntent) => void
}

export function PaymentIntentCancelDialog({
  intent,
  isOpen,
  onClose,
  onSuccess,
}: PaymentIntentCancelDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !intent) return null

  const handleConfirm = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const updated = await cancelPaymentIntentApi(intent.id)
      onSuccess(updated)
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel payment intent'
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0 duration-200"
    >
      <div
        className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-card p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 text-left"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-950/30 text-rose-400">
              <Ban className="size-5" />
            </div>
            <div>
              <h3 id="cancel-dialog-title" className="text-sm font-semibold text-foreground">
                Cancel Payment Intent
              </h3>
              <p className="font-mono text-xs text-muted-foreground truncate max-w-[240px]">
                {intent.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close dialog"
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Warning Banner */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs text-amber-300 flex items-start gap-2.5">
          <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-amber-200">Irreversible Action</p>
            <p className="text-amber-300/90 leading-relaxed text-[11px]">
              Cancelling will immediately invalidate this payment intent. Any customer attempting to pay via the checkout link will see a cancelled status and cannot proceed.
            </p>
          </div>
        </div>

        {/* Intent Summary */}
        <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Required Amount:</span>
            <span className="font-medium text-foreground">
              {describeAmountCondition(intent.conditions)}
            </span>
          </div>
          {intent.conditions.reference && (
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Reference:</span>
              <span className="font-mono text-foreground">{intent.conditions.reference}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-muted-foreground">
            <span>Current Status:</span>
            <span className="font-mono capitalize text-cyan-400">
              {intent.status.replace('_', ' ')}
            </span>
          </div>
        </div>

        {/* Error notification if mutation fails */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-3 text-xs text-rose-300"
          >
            {error}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-border bg-background px-3.5 py-2 text-xs font-medium text-foreground hover:bg-muted transition disabled:opacity-50"
          >
            Keep Active
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-rose-500 transition shadow-sm disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                <span>Cancelling...</span>
              </>
            ) : (
              <>
                <Ban className="size-3.5" />
                <span>Yes, Cancel Intent</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
