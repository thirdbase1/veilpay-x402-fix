'use client'

import { useEffect, useRef } from 'react'

/**
 * VeilStream — the hero's signature animation.
 *
 * Rows of "payment records" (address fragments, amounts, hashes) drift
 * across the canvas. Each character dissolves from plaintext into redaction
 * glyphs as it travels: privacy happening in motion. Fully custom canvas
 * renderer — no libraries, DPR-aware, pauses when hidden, static under
 * reduced motion.
 */

const GLYPHS = '0123456789abcdefABCDEF'
const BLOCKS = ['█', '▓', '▒', '░']

interface Stream {
  y: number // 0..1 vertical position
  speed: number // px/s
  offset: number // px, start position
  chars: number
  fontSize: number
  phase: number // veil phase offset
  alpha: number
  hot: boolean // indigo-highlighted stream
}

function randomStream(index: number, total: number): Stream {
  return {
    y: (index + 0.5) / total,
    speed: 14 + Math.random() * 26,
    offset: Math.random() * 2400,
    chars: 26 + Math.floor(Math.random() * 22),
    fontSize: 10 + Math.random() * 3,
    phase: Math.random() * 100,
    alpha: 0.16 + Math.random() * 0.3,
    hot: Math.random() < 0.18,
  }
}

/** Deterministic-ish veil factor for a character slot: 0 plaintext, 1 block. */
function veilFactor(stream: Stream, i: number, t: number): number {
  const v = Math.sin(t * 0.45 + stream.phase + i * 0.32) * 0.5 + 0.5
  return v * v // bias toward veiled
}

export function VeilCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    let running = true
    let width = 0
    let height = 0
    let dpr = 1

    const streams: Stream[] = Array.from({ length: 16 }, (_, i) => randomStream(i, 16))

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const drawChar = (s: Stream, i: number, x: number, y: number, t: number) => {
      const vf = veilFactor(s, i, t)
      let char: string
      let color: string

      if (vf < 0.45) {
        // Plaintext zone — address/hash fragments
        const seed = Math.floor(s.phase * 7 + i * 13.7)
        char = GLYPHS[seed % GLYPHS.length]
        color = s.hot ? 'rgb(94 106 210)' : 'rgb(138 143 152)'
      } else {
        // Veiled zone — redaction blocks
        const seed = Math.floor(s.phase * 3 + i * 7.9 + Math.floor(t * 0.8))
        char = BLOCKS[seed % BLOCKS.length]
        color = s.hot ? 'rgb(94 106 210)' : 'rgb(247 248 248)'
      }

      const alpha = s.alpha * (vf < 0.45 ? 0.8 : 1) * (0.55 + 0.45 * Math.sin(i * 0.5 + s.phase))
      ctx.globalAlpha = Math.max(0.04, Math.min(alpha, 0.55))
      ctx.fillStyle = color
      ctx.fillText(char, x, y)
    }

    const render = (t: number) => {
      ctx.clearRect(0, 0, width, height)
      ctx.textBaseline = 'middle'

      for (const s of streams) {
        ctx.font = `${s.fontSize}px ui-monospace, SFMono-Regular, Menlo, monospace`
        const charW = s.fontSize * 0.72
        const rowW = s.chars * charW
        const total = rowW + width
        const x0 = width - ((s.offset + t * s.speed) % total) // right → left drift
        const y = s.y * height

        for (let i = 0; i < s.chars; i++) {
          const x = x0 + i * charW
          if (x < -charW || x > width + charW) continue
          drawChar(s, i, x, y, t)
        }
      }
      ctx.globalAlpha = 1
    }

    const loop = (now: number) => {
      if (!running) return
      render(now / 1000)
      raf = requestAnimationFrame(loop)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    if (reduced) {
      // Static single frame — no motion.
      render(4.2)
    } else {
      raf = requestAnimationFrame(loop)
      const onVisibility = () => {
        if (document.hidden) {
          running = false
          cancelAnimationFrame(raf)
        } else if (!running) {
          running = true
          raf = requestAnimationFrame(loop)
        }
      }
      document.addEventListener('visibilitychange', onVisibility)
      return () => {
        running = false
        cancelAnimationFrame(raf)
        document.removeEventListener('visibilitychange', onVisibility)
        ro.disconnect()
      }
    }

    return () => {
      running = false
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />
}
