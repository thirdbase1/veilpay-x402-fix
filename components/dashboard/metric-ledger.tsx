interface MetricLedgerItem {
  label: string
  value: number | string
  subtext: string
  tone: 'primary' | 'accent' | 'warning' | 'destructive'
}

const toneClasses: Record<MetricLedgerItem['tone'], { tick: string; value: string }> = {
  primary: { tick: 'bg-primary', value: 'text-foreground' },
  accent: { tick: 'bg-accent', value: 'text-accent' },
  warning: { tick: 'bg-warning', value: 'text-warning' },
  destructive: { tick: 'bg-destructive', value: 'text-destructive' },
}

interface MetricLedgerProps {
  items: MetricLedgerItem[]
  isLoading?: boolean
}

/**
 * Ledger strip: one hairline-ruled band of oversized numerals instead of
 * four floating cards. The gap-px/bg-border trick draws the dividers.
 */
export function MetricLedger({ items, isLoading = false }: MetricLedgerProps) {
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/40 lg:grid-cols-4">
      {items.map((item, i) => {
        const tone = toneClasses[item.tone]
        return (
          <div
            key={item.label}
            className="veil-enter bg-card/60 p-4 transition-colors duration-300 hover:bg-card"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className={`size-1.5 rounded-[2px] ${tone.tick}`} />
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {item.label}
              </p>
            </div>
            {isLoading ? (
              <div className="mt-3 h-8 w-14 animate-pulse rounded-md bg-muted/40" />
            ) : (
              <p
                className={`mt-2.5 font-display text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl ${tone.value}`}
              >
                {item.value}
              </p>
            )}
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{item.subtext}</p>
          </div>
        )
      })}
    </div>
  )
}
