import React from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  PiggyBank,
  ArrowRight,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import type { DashboardPeriodTotals, DashboardSummary } from '../types'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface MetricsOverviewProps {
  summary?: DashboardSummary
  isLoading?: boolean
  currency: string
  locale: string
}

const EMPTY = '—'

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  summary,
  isLoading = false,
  currency,
  locale,
}) => {
  const money = (value: number | undefined) =>
    value === undefined ? EMPTY : formatCurrency(value, { currency, locale })

  const renderTrendBadge = (percentageChange: number) => {
    const isUp = percentageChange > 0
    const isDown = percentageChange < 0
    const formattedPercent = `${isUp ? '+' : ''}${percentageChange.toFixed(1)}%`

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums tracking-tight',
          isUp
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
            : isDown
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
            : 'bg-muted text-muted-foreground border border-border',
        )}
      >
        {isUp ? (
          <TrendingUp className="w-3 h-3" />
        ) : isDown ? (
          <TrendingDown className="w-3 h-3" />
        ) : (
          <Minus className="w-3 h-3" />
        )}
        <span>{formattedPercent}</span>
      </span>
    )
  }

  const renderComparison = (period: DashboardPeriodTotals | undefined, label: string) => {
    if (!period) {
      return <span className="text-muted-foreground">{isLoading ? 'Loading…' : EMPTY}</span>
    }
    const difference = period.currentTotal - period.previousTotal
    const formattedDiff = `${difference >= 0 ? '+' : '-'}${money(Math.abs(difference))}`
    return (
      <>
        {renderTrendBadge(period.percentageChange)}
        <span className="text-muted-foreground leading-snug">
          <strong className="text-foreground font-medium font-mono tabular-nums">{formattedDiff}</strong>
          <span className="sr-only sm:not-sr-only"> vs {label}</span>{' '}
          <span className="font-mono tabular-nums">({money(period.previousTotal)})</span>
        </span>
      </>
    )
  }

  const month = summary?.monthExpenses
  const year = summary?.yearExpenses
  const upcoming = summary?.upcomingThisMonth
  const overdue = summary?.overdue
  const pending = summary?.pending
  const budget = summary?.monthlyBudget
  const usedPercentage = budget?.usedPercentage ?? 0
  const overdueCount = overdue?.count ?? 0
  const pendingCount = pending?.count ?? 0
  const nextExpenseLabel = upcoming?.nextExpenseLabel?.trim() || EMPTY

  const payablesStrip = (position: 'top' | 'bottom') => (
    <div
      className={cn(
        'grid grid-cols-2 divide-x divide-border/60 text-xs',
        position === 'top' ? 'border-b border-border/60' : 'border-t border-border/60 bg-muted/15',
      )}
    >
      {/* Overdue Action Cell */}
      <Link
        to="/expenses/overdue"
        className={cn(
          'group flex items-center justify-between gap-2 px-3.5 py-2.5 sm:px-5 transition-colors min-w-0',
          overdueCount > 0
            ? 'bg-destructive/[0.06] hover:bg-destructive/[0.11]'
            : 'hover:bg-accent/40',
        )}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          {overdueCount > 0 ? (
            <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <span className="text-muted-foreground hidden sm:inline">Overdue</span>
          <Badge
            variant={overdueCount > 0 ? 'destructive' : 'success'}
            className="text-[10px] px-1.5 py-0 truncate"
            data-testid="overdue-count"
          >
            {!overdue ? EMPTY : overdueCount > 0 ? `${overdueCount} overdue` : 'All settled'}
          </Badge>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span
            className={cn(
              'font-mono tabular-nums font-semibold',
              overdueCount > 0 ? 'text-destructive' : 'text-muted-foreground',
            )}
            data-testid="overdue-total"
          >
            {money(overdue?.totalAmount)}
          </span>
          {overdueCount > 0 && (
            <ArrowRight className="w-3 h-3 text-destructive/80 group-hover:translate-x-0.5 transition-transform" />
          )}
        </div>
      </Link>

      {/* Pending Action Cell */}
      <Link
        to="/expenses?status=PENDING"
        className="group flex items-center justify-between gap-2 px-3.5 py-2.5 sm:px-5 hover:bg-accent/40 transition-colors min-w-0"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          <span className="text-muted-foreground hidden sm:inline">Pending</span>
          <Badge
            variant={pendingCount > 0 ? 'warning' : 'secondary'}
            className="text-[10px] px-1.5 py-0 truncate"
            data-testid="pending-count"
          >
            {pending ? `${pending.count} pending` : EMPTY}
          </Badge>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span
            className="font-mono tabular-nums font-semibold text-foreground"
            data-testid="pending-total"
          >
            {money(pending?.totalAmount)}
          </span>
          <ArrowRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hidden sm:block" />
        </div>
      </Link>
    </div>
  )

  return (
    <section
      className={cn('transition-opacity', isLoading && !summary && 'opacity-60')}
      aria-label="Key Financial Performance Metrics"
      aria-busy={isLoading}
    >
      <div className="rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs overflow-hidden">
        {/* Urgent Payables Banner promoted to top when overdue items exist */}
        {overdueCount > 0 && payablesStrip('top')}

        {/* Hero Band: Month Spend + Integrated Monthly Budget */}
        <div className="p-4 sm:p-5 md:grid md:grid-cols-12 md:gap-6 md:items-center space-y-3.5 md:space-y-0">
          {/* Primary Metric: This Month's Spend */}
          <div className="md:col-span-7 space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              This month&apos;s spend
            </span>

            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
              <div
                className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums"
                data-testid="month-current-total"
              >
                {money(month?.currentTotal)}
              </div>

              <div
                className="flex flex-wrap items-center gap-1.5 text-xs"
                data-testid="month-comparison"
              >
                {renderComparison(month, 'last month')}
              </div>
            </div>
          </div>

          {/* Integrated Monthly Budget Gauge */}
          <div className="md:col-span-5 pt-3 md:pt-0 border-t md:border-t-0 md:border-l border-border/60 md:pl-6 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Link
                to="/budgets"
                className="group inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <PiggyBank className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Monthly budget</span>
                <ArrowRight className="w-3 h-3 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </Link>

              <Badge
                variant={usedPercentage > 90 ? 'destructive' : 'outline'}
                className="text-[11px] font-mono tabular-nums px-2 py-0"
                data-testid="budget-used"
              >
                {budget ? `${usedPercentage.toFixed(0)}% used` : EMPTY}
              </Badge>
            </div>

            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  usedPercentage > 90
                    ? 'bg-destructive'
                    : usedPercentage > 75
                    ? 'bg-amber-500'
                    : 'bg-primary',
                )}
                style={{ width: `${Math.max(0, Math.min(100, usedPercentage))}%` }}
              />
            </div>

            <div className="flex items-baseline justify-between gap-2 text-[11px] text-muted-foreground">
              <span>
                Remaining{' '}
                <strong
                  className="font-semibold text-foreground font-mono tabular-nums"
                  data-testid="budget-remaining"
                >
                  {money(budget?.totalRemaining)}
                </strong>
              </span>
              <span>
                of{' '}
                <span className="font-mono tabular-nums text-foreground font-medium" data-testid="budget-total">
                  {money(budget?.totalBudget)}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Secondary Compact 2-Column Split: Upcoming & Year-to-Date */}
        <div className="grid grid-cols-2 divide-x divide-border/60 border-t border-border/60">
          {/* Upcoming This Month */}
          <Link
            to="/expenses?status=PENDING"
            className="p-3.5 sm:px-5 sm:py-4 space-y-1 hover:bg-accent/30 transition-colors min-w-0 block"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-medium text-muted-foreground truncate">
                Upcoming
              </span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-medium shrink-0">
                {upcoming ? `${upcoming.count} scheduled` : EMPTY}
              </Badge>
            </div>

            <div
              className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-mono tabular-nums truncate"
              data-testid="upcoming-total"
            >
              {money(upcoming?.totalAmount)}
            </div>

            <p className="text-[11px] text-muted-foreground truncate" data-testid="upcoming-next">
              Next: {upcoming ? nextExpenseLabel : EMPTY}
            </p>
          </Link>

          {/* Year-to-Date (YTD) */}
          <div className="p-3.5 sm:px-5 sm:py-4 space-y-1 min-w-0">
            <span className="text-xs font-medium text-muted-foreground block truncate">
              Year to date
            </span>

            <div
              className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-mono tabular-nums truncate"
              data-testid="year-current-total"
            >
              {money(year?.currentTotal)}
            </div>

            <div
              className="flex flex-wrap items-center gap-1.5 text-[11px]"
              data-testid="year-comparison"
            >
              {renderComparison(year, 'last year YTD')}
            </div>
          </div>
        </div>

        {/* Quiet Payables Footer Strip when zero overdue items */}
        {overdueCount === 0 && payablesStrip('bottom')}
      </div>
    </section>
  )
}
