import React from 'react'
import { cn } from '@/lib/utils'
import type { BudgetPeriodSummary } from '../types'

interface BudgetProgressBarProps {
  summary: BudgetPeriodSummary
  className?: string
  /** Visual size of the track. */
  size?: 'sm' | 'md'
}

const FILL_BY_HEALTH: Record<BudgetPeriodSummary['health'], string> = {
  ON_TRACK: 'bg-primary',
  WARNING: 'bg-amber-500',
  EXCEEDED: 'bg-destructive',
}

/**
 * Consumption bar with a subtle tick marking where the warning threshold sits.
 */
export const BudgetProgressBar: React.FC<BudgetProgressBarProps> = ({ summary, className, size = 'md' }) => {
  const fill = Number.isFinite(summary.consumedPercent) ? Math.min(100, Math.max(0, summary.consumedPercent)) : 100
  const warningPos =
    summary.allocated > 0 ? Math.min(100, Math.max(0, (summary.warningAt / summary.allocated) * 100)) : null
  const label = Number.isFinite(summary.consumedPercent) ? `${summary.consumedPercent.toFixed(1)}%` : 'over'

  return (
    <div
      role="progressbar"
      aria-label="Budget consumption"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fill)}
      aria-valuetext={`${label} of allocation spent`}
      className={cn(
        'relative w-full overflow-hidden rounded-full bg-muted',
        size === 'sm' ? 'h-1.5' : 'h-2',
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none',
          FILL_BY_HEALTH[summary.health],
        )}
        style={{ width: `${fill}%` }}
      />
      {warningPos !== null && warningPos > 0 && warningPos < 100 && (
        <span
          aria-hidden
          title="Warning threshold"
          className="absolute top-0 h-full w-px bg-foreground/30"
          style={{ left: `${warningPos}%` }}
        />
      )}
    </div>
  )
}
