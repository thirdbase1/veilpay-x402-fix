'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Copy, Check, ExternalLink, QrCode } from 'lucide-react'
import { QRCodeView } from './qr-code'

interface PaymentLinkPanelProps {
  intentId: string
  origin?: string
}

export function PaymentLinkPanel({ intentId, origin = '' }: PaymentLinkPanelProps) {
  const [copied, setCopied] = useState(false)
  const [showQR, setShowQR] = useState(false)

  // Construct absolute payment URL
  const paymentPath = `/pay/${intentId}`
  const fullUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${paymentPath}`
    : `${origin}${paymentPath}`

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card/40 p-6 backdrop-blur-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            Customer Checkout Link
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Share this link with your customer or embed it in your checkout workflow.
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

      {/* URL display + action bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="flex-1 overflow-hidden rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
          <p className="truncate select-all">{fullUrl}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopy}
            className="flex-1 sm:flex-initial inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/80 px-3 text-xs font-medium text-foreground transition hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
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
            className="flex-1 sm:flex-initial inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span>Open Checkout</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </div>
      </div>

      {/* QR Code expansion */}
      {showQR && (
        <div className="pt-2 flex flex-col items-center justify-center border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-3">
            Scan to open customer payment interface
          </p>
          <QRCodeView value={fullUrl} size={180} />
          <p className="mt-2 font-mono text-[11px] text-muted-foreground/80">
            {paymentPath}
          </p>
        </div>
      )}
    </div>
  )
}
