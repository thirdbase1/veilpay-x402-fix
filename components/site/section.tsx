import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface SectionProps {
  id?: string
  children: ReactNode
  className?: string
  /** Centered container width. */
  containerClassName?: string
}

export function Section({ id, children, className, containerClassName }: SectionProps) {
  return (
    <section
      id={id}
      className={cn('scroll-mt-24 border-t border-border/60 py-20 sm:py-28', className)}
    >
      <div className={cn('mx-auto w-full max-w-6xl px-5 sm:px-8', containerClassName)}>
        {children}
      </div>
    </section>
  )
}

export function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="mb-4 font-mono text-xs font-medium uppercase tracking-[0.2em] text-primary">
      {children}
    </p>
  )
}

export function SectionHeading({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2
      className={cn(
        'text-balance text-3xl font-semibold tracking-tight sm:text-4xl',
        className,
      )}
    >
      {children}
    </h2>
  )
}
