import React from 'react'
import { History, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { BudgetPeriod, BudgetPeriodicity } from '../types'
import { describeWarningRule, formatDateRange, formatPeriodLabel, sortPeriodsDesc, summarizePeriod } from '../utils/budgetMath'
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
  const money = (n: number) => formatCurrency(n, { currency, locale })

  if (periods.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <History className="h-5 w-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">No periods yet</p>
        <p className="max-w-md text-xs text-muted-foreground">
          Period instances are created automatically when the first expense in a tracked category is recorded for
          that period. Expenses dated before a period exists won't be linked retroactively.
        </p>
      </div>
    )
  }

  return (
    <div className="custom-scrollbar overflow-x-auto">
      <table className="w-full min-w-[760px] text-xs">
        <thead>
          <tr className="border-b border-border/60 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <th scope="col" className="px-4 py-2.5">Period</th>
            <th scope="col" className="px-4 py-2.5">Status</th>
            <th scope="col" className="px-4 py-2.5 text-right">Allocated</th>
            <th scope="col" className="px-4 py-2.5 text-right">Spent</th>
            <th scope="col" className="px-4 py-2.5 text-right">Remaining</th>
            <th scope="col" className="w-40 px-4 py-2.5">Usage</th>
            <th scope="col" className="px-4 py-2.5">Warning rule</th>
            {canEdit && <th scope="col" className="px-4 py-2.5 text-right"><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {sortPeriodsDesc(periods).map((period) => {
            const s = summarizePeriod(period)
            const isCurrent = period.id === currentPeriodId
            const label = formatPeriodLabel(period, periodicity, locale)
            return (
              <tr
                key={period.id}
                className={cn(
                  'border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40',
                  isCurrent && 'bg-primary/[0.04]',
                )}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    {label}
                    {isCurrent && (
                      <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{formatDateRange(period, locale)}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1">
                    <PeriodStatusBadge status={period.status} />
                    {s.health !== 'ON_TRACK' && <BudgetHealthBadge health={s.health} />}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{money(s.allocated)}</td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">{money(s.spent)}</td>
                <td className={cn('px-4 py-3 text-right font-mono font-semibold tabular-nums', s.remaining < 0 && 'text-destructive')}>
                  {money(s.remaining)}
                </td>
                <td className="px-4 py-3">
                  <BudgetProgressBar summary={s} size="sm" />
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {Number.isFinite(s.consumedPercent) ? `${s.consumedPercent.toFixed(1)}%` : '—'}
                  </div>
                </td>
                <td className="px-4 py-3 text-[11px] text-muted-foreground">
                  {describeWarningRule(period.warningType, period.warningThreshold, money)}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onAdjust(period)}
                      aria-label={`Adjust period ${label}`}
                      className="h-7 gap-1 text-[11px]"
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
