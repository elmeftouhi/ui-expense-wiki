import React from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import type { BudgetPeriod, BudgetPeriodicity } from '../types'
import { formatDateRange, formatPeriodLabel, formatWarningThreshold, sortPeriodsDesc, summarizePeriod } from '../utils/budgetMath'
import { BudgetHealthBadge, PeriodStatusBadge } from './BudgetStatusBadges'
import { BudgetProgressBar } from './BudgetProgressBar'

interface PeriodHistoryTableProps {
  periods: BudgetPeriod[]
  periodicity: BudgetPeriodicity
  currency: string
  locale?: string
  currentPeriodId?: number | null
  canEdit: boolean
  onAdjust: (period: BudgetPeriod) => void
}

export const PeriodHistoryTable: React.FC<PeriodHistoryTableProps> = ({
  periods,
  periodicity,
  currency,
  locale,
  currentPeriodId,
  canEdit,
  onAdjust,
}) => {
  const isDesktop = useMediaQuery('(min-width: 768px)', true)
  const money = (n: number) => formatCurrency(n, { currency, locale })

  if (periods.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-xs text-muted-foreground">
        No periods recorded yet.
      </div>
    )
  }

  const sorted = sortPeriodsDesc(periods)

  if (!isDesktop) {
    return (
      <ul className="divide-y divide-border/60">
        {sorted.map((period) => {
          const s = summarizePeriod(period)
          const isCurrent = period.id === currentPeriodId
          const label = formatPeriodLabel(period, periodicity, locale)
          return (
            <li key={period.id} className={cn('space-y-2.5 p-4 text-xs', isCurrent && 'bg-primary/[0.03]')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-foreground">
                    <span>{label}</span>
                    {isCurrent && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">{formatDateRange(period, locale)}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <PeriodStatusBadge status={period.status} />
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAdjust(period)}
                      aria-label={`Adjust period ${label}`}
                      className="h-8 px-2 text-xs"
                    >
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    'font-mono text-sm font-semibold tabular-nums',
                    s.remaining < 0 ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {money(s.remaining)}
                  <span className="ml-1 font-sans text-[11px] font-normal text-muted-foreground">remaining</span>
                </span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {money(s.spent)} / {money(s.allocated)}
                </span>
              </div>

              <BudgetProgressBar summary={s} size="sm" />
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="custom-scrollbar overflow-x-auto">
      <table className="w-full min-w-[700px] text-xs">
        <thead className="border-b border-border/60 bg-muted/25">
          <tr className="text-left text-[11px] font-medium text-muted-foreground">
            <th scope="col" className="px-4 py-2.5">Period</th>
            <th scope="col" className="px-4 py-2.5">Status</th>
            <th scope="col" className="px-4 py-2.5 text-right">Allocated</th>
            <th scope="col" className="px-4 py-2.5 text-right">Spent</th>
            <th scope="col" className="px-4 py-2.5 text-right">Remaining</th>
            <th scope="col" className="w-36 px-4 py-2.5">Usage</th>
            <th scope="col" className="px-4 py-2.5 text-right">Warning</th>
            {canEdit && (
              <th scope="col" className="px-4 py-2.5 text-right">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {sorted.map((period) => {
            const s = summarizePeriod(period)
            const isCurrent = period.id === currentPeriodId
            const label = formatPeriodLabel(period, periodicity, locale)
            return (
              <tr
                key={period.id}
                className={cn(
                  'transition-colors hover:bg-muted/25',
                  isCurrent && 'bg-primary/[0.03]',
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <span>{label}</span>
                    {isCurrent && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{formatDateRange(period, locale)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-1">
                    <PeriodStatusBadge status={period.status} />
                    {s.health !== 'ON_TRACK' && <BudgetHealthBadge health={s.health} />}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                  {money(s.allocated)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-foreground">
                  {money(s.spent)}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right font-mono font-semibold tabular-nums',
                    s.remaining < 0 ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {money(s.remaining)}
                </td>
                <td className="px-4 py-3">
                  <BudgetProgressBar summary={s} size="sm" />
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                  {formatWarningThreshold(period.warningType, period.warningThreshold, money)}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAdjust(period)}
                      aria-label={`Adjust period ${label}`}
                      className="h-7 gap-1 px-2 text-[11px]"
                    >
                      <SlidersHorizontal className="h-3 w-3" />
                      Adjust
                    </Button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
