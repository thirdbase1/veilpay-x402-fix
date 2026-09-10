'use client'

import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Loader2 } from 'lucide-react'

interface QRCodeViewProps {
  value: string
  size?: number
  className?: string
}

export function QRCodeView({ value, size = 200, className = '' }: QRCodeViewProps) {
  const [svgString, setSvgString] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (!value) {
      setSvgString(null)
      return
    }

    QRCode.toString(value, {
      type: 'svg',
      width: size,
      margin: 1,
      color: {
        dark: '#ffffff',
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
  }, [value, size])

  if (error) {
    return (
      <div className="flex size-48 flex-col items-center justify-center rounded-xl border border-border bg-card/60 p-4 text-center text-xs text-muted-foreground">
        <p className="text-rose-400">QR Generation Error</p>
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
    <div
      className={`relative inline-block overflow-hidden rounded-xl border border-border/80 bg-[#090a0f] p-3 shadow-xl ${className}`}
      dangerouslySetInnerHTML={{ __html: svgString }}
      aria-label="Payment URL QR Code"
    />
  )
}
