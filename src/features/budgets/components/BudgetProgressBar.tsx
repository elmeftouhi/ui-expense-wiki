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
  ON_TRACK: 'bg-gradient-to-r from-emerald-500 to-emerald-400',
  WARNING: 'bg-gradient-to-r from-amber-500 to-amber-400',
  EXCEEDED: 'bg-gradient-to-r from-rose-600 to-destructive',
}

/**
 * Consumption bar with a tick marking where the warning threshold sits.
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
        size === 'sm' ? 'h-1.5' : 'h-2.5',
        className,
      )}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none', FILL_BY_HEALTH[summary.health])}
        style={{ width: `${fill}%` }}
      />
      {warningPos !== null && warningPos < 100 && (
        <span
          aria-hidden
          title="Warning threshold"
          className="absolute top-0 h-full w-0.5 bg-foreground/40"
          style={{ left: `${warningPos}%` }}
        />
      )}
    </div>
  )
}
