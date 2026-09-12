'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Signature landing animation: content starts covered by a solid redaction
 * bar; when scrolled into view the bar wipes away in reading order,
 * "lifting the veil" to reveal the words. Falls back to plain content under
 * prefers-reduced-motion.
 */
export function RedactedReveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
          }
        }
      },
      { threshold: 0.3 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <span ref={ref} className={cn('relative inline-block', className)}>
      {children}
      <span
        aria-hidden="true"
        style={{ animationDelay: `${delay}ms` }}
        className={cn(
          'redact-bar pointer-events-none absolute -inset-x-1.5 inset-y-0 rounded-[4px] bg-foreground',
          visible && 'redact-bar-run',
        )}
      />
    </span>
  )
}
