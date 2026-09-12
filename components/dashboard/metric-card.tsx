import type { ReactNode } from 'react'

interface MetricCardProps {
  title: string
  value: number | string
  subtext: string
  icon: ReactNode
  isLoading?: boolean
  trend?: string
}

export function MetricCard({ title, value, subtext, icon, isLoading = false }: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 p-5 transition duration-300 hover:border-primary/40 hover:bg-card/70">
      {/* Accent hairline that lights up on hover */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition duration-300 group-hover:opacity-100"
      />
      {/* Soft amber bloom */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-primary/10 blur-2xl"
      />

      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </p>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/60 text-muted-foreground transition group-hover:border-primary/30 group-hover:text-primary">
          {icon}
        </span>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="h-9 w-20 animate-pulse rounded-md bg-muted/40" />
        ) : (
          <p className="font-display text-3xl font-semibold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
        )}
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{subtext}</p>
      </div>
    </div>
  )
}
