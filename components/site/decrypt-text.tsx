'use client'

import { useEffect, useState } from 'react'

/**
 * DecryptText — headline reveal where cipher glyphs resolve into the real
 * words, left to right, like a proof being verified. Runs once on mount.
 */

const NOISE = '█▓▒░<>/\\#%&@$01'

export function DecryptText({
  text,
  delay = 0,
  duration = 1100,
  className,
}: {
  text: string
  delay?: number
  duration?: number
  className?: string
}) {
  // Deterministic initial scramble: Math.random() here would make the server
  // and client render different glyphs and fail hydration. Deriving the noise
  // from the text itself keeps the scrambled look while matching on both sides.
  const [display, setDisplay] = useState(() =>
    text
      .split('')
      .map((c, i) =>
        c === ' ' ? ' ' : NOISE[(i * 7 + c.charCodeAt(0) * 3) % NOISE.length],
      )
      .join(''),
  )

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setDisplay(text)
      return
    }

    let raf = 0
    let cancelled = false
    const timer = setTimeout(() => {
      if (cancelled) return
      const t0 = performance.now()
      const tick = (now: number) => {
        if (cancelled) return
        const p = Math.min((now - t0) / duration, 1)
        const eased = 1 - Math.pow(1 - p, 3)
        const locked = Math.floor(eased * text.length)

        setDisplay(
          text
            .split('')
            .map((c, i) => {
              if (c === ' ') return ' '
              if (i < locked) return c
              return NOISE[Math.floor(Math.random() * NOISE.length)]
            })
            .join(''),
        )

        if (p < 1) raf = requestAnimationFrame(tick)
        else setDisplay(text)
      }
      raf = requestAnimationFrame(tick)
    }, delay)

    return () => {
      cancelled = true
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [text, delay, duration])

  return (
    <span className={className} aria-label={text}>
      {/* Screen readers get the real text; the scramble is decorative */}
      <span aria-hidden="true" className="tabular-nums">
        {display}
      </span>
    </span>
  )
}
