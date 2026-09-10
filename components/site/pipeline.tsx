import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type StepTone = 'neutral' | 'muted' | 'primary' | 'accent'

export interface PipelineStep {
  label: string
  tone?: StepTone
}

const toneClass: Record<StepTone, string> = {
  neutral: 'border-border bg-secondary/40 text-foreground',
  muted: 'border-border/60 bg-background/40 text-muted-foreground',
  primary: 'border-primary/40 bg-primary/10 text-primary',
  accent: 'border-accent/40 bg-accent/10 text-accent',
}

/**
 * Horizontal (wraps to vertical on mobile) labeled pipeline. Purely a diagram —
 * labels are conceptual stage names, never live values.
 */
export function Pipeline({
  steps,
  className,
}: {
  steps: PipelineStep[]
  className?: string
}) {
  return (
    <ol className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center', className)}>
      {steps.map((step, i) => (
        <li key={`${step.label}-${i}`} className="flex items-center gap-2 sm:contents">
          <span
            className={cn(
              'inline-flex items-center rounded-lg border px-3 py-2 text-xs font-medium sm:text-sm',
              toneClass[step.tone ?? 'neutral'],
            )}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <ChevronRight
              className="size-4 shrink-0 rotate-90 text-muted-foreground/60 sm:rotate-0"
              aria-hidden="true"
            />
          )}
        </li>
      ))}
    </ol>
  )
}
