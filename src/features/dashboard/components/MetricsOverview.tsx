import React from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Clock,
  AlertCircle,
  PiggyBank,
  Receipt,
  FileCheck,
  ArrowRight,
} from 'lucide-react'
import type { DashboardPeriodTotals, DashboardSummary } from '../types'
import { Card, CardContent } from '@/components/ui/card'
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
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums tracking-tight',
          isUp
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
            : isDown
            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
            : 'bg-muted text-muted-foreground border border-border',
        )}
      >
        {isUp ? (
          <TrendingUp className="w-3.5 h-3.5" />
        ) : isDown ? (
          <TrendingDown className="w-3.5 h-3.5" />
        ) : (
          <Minus className="w-3.5 h-3.5" />
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
        <span className="text-muted-foreground">
          <strong className="text-foreground font-medium">{formattedDiff}</strong> vs {label} ({money(period.previousTotal)})
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
  const nextExpenseLabel = upcoming?.nextExpenseLabel?.trim() || EMPTY

  return (
    <section
      className={cn('space-y-4 transition-opacity', isLoading && !summary && 'opacity-60')}
      aria-label="Key Financial Performance Metrics"
      aria-busy={isLoading}
    >
      {/* Primary KPI Row: This Month, This Year, Upcoming This Month */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 1. Total Expense This Month */}
        <Card className="relative overflow-hidden border-border/80 shadow-xs hover:border-border transition-all">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Expenses This Month
              </span>
              <div className="p-2 rounded-xl bg-primary/10 text-primary">
                <Receipt className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-2">
              <div
                className="text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums"
                data-testid="month-current-total"
              >
                {money(month?.currentTotal)}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs" data-testid="month-comparison">
                {renderComparison(month, 'last month')}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 2. Total Expense This Year */}
        <Card className="relative overflow-hidden border-border/80 shadow-xs hover:border-border transition-all">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Expenses This Year (YTD)
              </span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-2">
              <div
                className="text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums"
                data-testid="year-current-total"
              >
                {money(year?.currentTotal)}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs" data-testid="year-comparison">
                {renderComparison(year, 'last year YTD')}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Upcoming Expenses This Month */}
        <Card className="relative overflow-hidden border-border/80 shadow-xs hover:border-border transition-all">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Upcoming This Month
              </span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-2">
              <div
                className="text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums"
                data-testid="upcoming-total"
              >
                {money(upcoming?.totalAmount)}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[11px] font-medium">
                  {upcoming ? `${upcoming.count} scheduled` : EMPTY}
                </Badge>
                <span className="truncate" data-testid="upcoming-next">
                  Next: {upcoming ? nextExpenseLabel : EMPTY}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Operational Metrics Row: Budget, Pending, Overdue */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 6. Monthly Budget */}
        <Card className="border-border/80 shadow-xs group hover:border-border transition-all">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <Link
                to="/budgets"
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors cursor-pointer"
                title="View all budgets & consuming state"
              >
                <PiggyBank className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Monthly Budget</span>
                <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <Badge
                variant={usedPercentage > 90 ? 'destructive' : 'outline'}
                className="text-[11px] font-mono"
                data-testid="budget-used"
              >
                {budget ? `${usedPercentage.toFixed(0)}% used` : EMPTY}
              </Badge>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-muted-foreground text-[11px]">Total budget</span>
                <span className="font-semibold text-foreground font-mono" data-testid="budget-total">
                  {money(budget?.totalBudget)}
                </span>
              </div>

              {/* Progress Bar */}
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

              <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
                <span>
                  Remaining:{' '}
                  <strong className="font-semibold text-foreground font-mono" data-testid="budget-remaining">
                    {money(budget?.totalRemaining)}
                  </strong>
                </span>
                <Link
                  to="/budgets"
                  className="text-[10px] text-primary hover:underline font-medium flex items-center gap-0.5"
                >
                  <span>Budgets</span>
                  <ArrowRight className="w-2.5 h-2.5" />
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 5. Pending */}
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <FileCheck className="w-4 h-4 text-primary" />
                <span>Pending</span>
              </div>
              <Badge variant="warning" className="text-[11px]" data-testid="pending-count">
                {pending ? `${pending.count} pending` : EMPTY}
              </Badge>
            </div>

            <div className="space-y-1">
              <div
                className="text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums"
                data-testid="pending-total"
              >
                {money(pending?.totalAmount)}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Awaiting payment or confirmation
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 4. Overdue */}
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <AlertCircle
                  className={cn(
                    'w-4 h-4',
                    overdueCount > 0 ? 'text-destructive' : 'text-emerald-500',
                  )}
                />
                <span>Overdue</span>
              </div>
              <Badge
                variant={overdueCount > 0 ? 'destructive' : 'success'}
                className="text-[11px]"
                data-testid="overdue-count"
              >
                {!overdue ? EMPTY : overdueCount > 0 ? `${overdueCount} overdue` : 'All settled'}
              </Badge>
            </div>

            <div className="space-y-1">
              <div
                className="text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums"
                data-testid="overdue-total"
              >
                {money(overdue?.totalAmount)}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {overdueCount > 0
                  ? 'Immediate disbursement required'
                  : 'Zero outstanding overdue payments'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
