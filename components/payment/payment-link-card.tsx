'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Copy,
  Check,
  ExternalLink,
  QrCode,
  Share2,
  AlertCircle,
} from 'lucide-react'
import { PaymentQR } from './payment-qr'
import type { PaymentIntentStatus } from '@/lib/payments/types'

interface PaymentLinkCardProps {
  intentId: string
  status: string
  reference?: string
  /** One-time payment secret — embedded in the URL fragment so the scanned
   * checkout can actually settle the intent. Never sent to the server. */
  paymentSecret?: string
}

const statusDisplay: Record<string, string> = {
  draft: 'Draft',
  awaiting_payment: 'Awaiting Payment',
  verifying: 'Verifying',
  verified: 'Verified',
  expired: 'Expired',
  failed: 'Failed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export function PaymentLinkCard({
  intentId,
  status,
  reference,
  paymentSecret,
}: PaymentLinkCardProps) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(true)
  const [origin, setOrigin] = useState('')
  const [canShare, setCanShare] = useState(false)

  const isInactive = ['expired', 'cancelled', 'failed'].includes(status)
  const paymentPath = `/pay/${intentId}`
  const secretFragment = paymentSecret ? `#ps=${encodeURIComponent(paymentSecret)}` : ''

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin)
      if (typeof navigator !== 'undefined' && 'share' in navigator) {
        setCanShare(true)
      }
    }
  }, [])

  const fullUrl = origin ? `${origin}${paymentPath}${secretFragment}` : `${paymentPath}${secretFragment}`

  const handleCopy = async () => {
    if (!navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  const handleNativeShare = async () => {
    if (!navigator.share) return
    try {
      await navigator.share({
        title: `VeilPay Checkout ${reference ? `(${reference})` : ''}`,
        text: 'Private payment verification on Midnight',
        url: fullUrl,
      })
    } catch {
      // User cancelled share or unsupported
    }
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-border/60 pb-4">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Customer Payment Link
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Share this link with the customer to complete the payment.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowQR((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition self-start sm:self-auto ${
            showQR
              ? 'border-primary/50 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-muted/40 hover:text-foreground'
          }`}
        >
          <QrCode className="size-3.5" />
          {showQR ? 'Hide QR' : 'Show QR'}
        </button>
      </div>

      {isInactive && (
        <div className="rounded-xl border border-warning/30 bg-warning/20 p-3 flex items-center gap-2 text-xs text-warning">
          <AlertCircle className="size-4 shrink-0 text-warning" />
          <span>
            This invoice is inactive ({statusDisplay[status] || status}). Checkout will reject submissions.
          </span>
        </div>
      )}

      {/* URL display + actions */}
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border border-border bg-background/80 p-2.5">
          <p className="font-mono text-xs text-foreground truncate select-all">
            {fullUrl}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/80 px-3 text-xs font-medium text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-accent" />
                <span className="text-accent">Copied</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <Link
            href={paymentPath}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
              isInactive
                ? 'border border-border bg-muted/60 text-muted-foreground hover:bg-muted'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            <span>Open Checkout</span>
            <ExternalLink className="size-3.5" />
          </Link>

          {canShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="col-span-2 sm:col-span-1 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted/40 transition-colors"
            >
              <Share2 className="size-3.5" />
              <span>Share Link</span>
            </button>
          )}
        </div>
      </div>

      {/* QR Code Section */}
      {showQR && (
        <div className="pt-2 border-t border-border/50 flex flex-col items-center">
          <PaymentQR url={fullUrl} size={180} disabled={isInactive} />
        </div>
      )}
    </div>
  )
}
