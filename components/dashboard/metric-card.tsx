import type { ReactNode } from 'react'

interface MetricCardProps {
  title: string
  value: number | string
  subtext: string
  icon: ReactNode
  isLoading?: boolean
  trend?: string
}

export function MetricCard({
  title,
  value,
  subtext,
  icon,
  isLoading = false,
}: MetricCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border/70 bg-card/50 p-4 sm:p-5 transition hover:border-border/90 hover:bg-card/70">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className="rounded-lg border border-border/50 bg-background/60 p-2 text-muted-foreground transition group-hover:text-foreground">
          {icon}
        </div>
      </div>

      <div className="mt-3">
        {isLoading ? (
          <div className="h-8 w-16 animate-pulse rounded bg-muted/40" />
        ) : (
          <p className="font-mono text-2xl font-semibold tracking-tight text-foreground">
            {value}
          </p>
        )}
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          {subtext}
        </p>
      </div>
    </div>
  )
}
