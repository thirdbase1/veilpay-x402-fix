'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Loader2, QrCode as QrIcon, Download } from 'lucide-react'

interface PaymentQRProps {
  url: string
  size?: number
  disabled?: boolean
  className?: string
}

export function PaymentQR({
  url,
  size = 200,
  disabled = false,
  className = '',
}: PaymentQRProps) {
  const [svgString, setSvgString] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (!url) {
      setSvgString(null)
      return
    }

    QRCode.toString(url, {
      type: 'svg',
      width: size,
      margin: 1,
      color: {
        dark: disabled ? '#71717a' : '#ffffff',
        light: '#090a0f',
      },
    })
      .then((svg) => {
        if (active) {
          setSvgString(svg)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          const msg = err instanceof Error ? err.message : 'QR code generation failed'
          setError(msg)
        }
      })

    return () => {
      active = false
    }
  }, [url, size, disabled])

  const handleDownload = () => {
    if (!svgString) return
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `veilpay-qr.svg`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
  }

  if (error) {
    return (
      <div className="flex size-48 flex-col items-center justify-center rounded-xl border border-border bg-card/60 p-4 text-center text-xs text-muted-foreground">
        <p className="text-destructive">QR Generation Error</p>
        <p className="mt-1 text-[10px]">{error}</p>
      </div>
    )
  }

  if (!svgString) {
    return (
      <div className="flex size-48 items-center justify-center rounded-xl border border-border bg-card/60">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className={`flex flex-col items-center gap-2.5 ${className}`}>
      <div
        className={`relative inline-block overflow-hidden rounded-xl border border-border/80 bg-[#090a0f] p-3 shadow-xl ${
          disabled ? 'opacity-50 grayscale' : ''
        }`}
        dangerouslySetInnerHTML={{ __html: svgString }}
        aria-label="Payment URL QR Code"
      />
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1">
          <QrIcon className="size-3 text-primary" />
          Scan to Pay
        </span>
        <span aria-hidden className="size-1 rounded-full bg-muted-foreground/40" />
        <button
          type="button"
          onClick={handleDownload}
          className="font-mono text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
        >
          <Download className="size-3" />
          Download SVG
        </button>
      </div>
    </div>
  )
}
