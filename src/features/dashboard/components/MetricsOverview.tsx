import React from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  AlertCircle,
  PiggyBank,
  Receipt,
  FileCheck,
  ArrowRight,
} from 'lucide-react'
import type { DashboardKpiMetrics } from '../types'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface MetricsOverviewProps {
  kpis: DashboardKpiMetrics
  currency: string
  locale: string
}

export const MetricsOverview: React.FC<MetricsOverviewProps> = ({
  kpis,
  currency,
  locale,
}) => {
  const { thisMonth, thisYear, upcomingExpenses, pendingApprovals, budgetUtilization, overdue } =
    kpis

  const renderTrendBadge = (
    percentageChange: number,
    trend: 'up' | 'down' | 'neutral',
  ) => {
    const isUp = trend === 'up'
    const formattedPercent = `${isUp ? '+' : ''}${percentageChange.toFixed(1)}%`

    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums tracking-tight',
          isUp
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20'
            : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20',
        )}
      >
        {isUp ? (
          <TrendingUp className="w-3.5 h-3.5" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5" />
        )}
        <span>{formattedPercent}</span>
      </span>
    )
  }

  // Formatting Month comparison details
  const diffSignMonth = thisMonth.difference >= 0 ? '+' : '-'
  const formattedDiffMonth = `${diffSignMonth}${formatCurrency(Math.abs(thisMonth.difference), {
    currency,
    locale,
  })}`
  const formattedPrevMonth = formatCurrency(thisMonth.previousAmount, { currency, locale })

  // Formatting Year comparison details
  const diffSignYear = thisYear.difference >= 0 ? '+' : '-'
  const formattedDiffYear = `${diffSignYear}${formatCurrency(Math.abs(thisYear.difference), {
    currency,
    locale,
  })}`
  const formattedPrevYear = formatCurrency(thisYear.previousAmount, { currency, locale })

  return (
    <section className="space-y-4" aria-label="Key Financial Performance Metrics">
      {/* Primary KPI Row: This Month, This Year, Total Upcoming */}
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
              <div className="text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {formatCurrency(thisMonth.currentAmount, { currency, locale })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                {renderTrendBadge(thisMonth.percentageChange, thisMonth.trend)}
                <span className="text-muted-foreground">
                  <strong className="text-foreground font-medium">{formattedDiffMonth}</strong> vs last month ({formattedPrevMonth})
                </span>
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
              <div className="text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {formatCurrency(thisYear.currentAmount, { currency, locale })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
                {renderTrendBadge(thisYear.percentageChange, thisYear.trend)}
                <span className="text-muted-foreground">
                  <strong className="text-foreground font-medium">{formattedDiffYear}</strong> vs 2025 YTD ({formattedPrevYear})
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3. Total Upcoming Expenses */}
        <Card className="relative overflow-hidden border-border/80 shadow-xs hover:border-border transition-all">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Total Upcoming Expenses
              </span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-3xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {formatCurrency(upcomingExpenses.totalAmount, { currency, locale })}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[11px] font-medium">
                  {upcomingExpenses.count} scheduled
                </Badge>
                {upcomingExpenses.nextDueDate && (
                  <span className="truncate">
                    Next:{' '}
                    {upcomingExpenses.nextItemTitle ? `${upcomingExpenses.nextItemTitle} · ` : ''}
                    {formatDate(upcomingExpenses.nextDueDate, { locale, dateStyle: 'medium' })}
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Operational Metrics Row: Budget, Pending Approvals, Overdue */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* 4. Monthly Budget Utilization */}
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
                variant={budgetUtilization.percentage > 90 ? 'destructive' : 'outline'}
                className="text-[11px] font-mono"
              >
                {budgetUtilization.percentage.toFixed(0)}% used
              </Badge>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-semibold text-foreground font-mono">
                  {formatCurrency(budgetUtilization.spent, { currency, locale })}
                </span>
                <span className="text-muted-foreground font-mono text-[11px]">
                  of {formatCurrency(budgetUtilization.monthlyBudget, { currency, locale })}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    budgetUtilization.percentage > 90
                      ? 'bg-destructive'
                      : budgetUtilization.percentage > 75
                      ? 'bg-amber-500'
                      : 'bg-primary',
                  )}
                  style={{ width: `${Math.min(100, budgetUtilization.percentage)}%` }}
                />
              </div>

              <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-0.5">
                <span>
                  Remaining:{' '}
                  <strong className="font-semibold text-foreground font-mono">
                    {formatCurrency(budgetUtilization.remaining, { currency, locale })}
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

        {/* 5. Pending Approvals */}
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <FileCheck className="w-4 h-4 text-primary" />
                <span>Pending Approvals</span>
              </div>
              <Badge variant="warning" className="text-[11px]">
                {pendingApprovals.count} reports
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {formatCurrency(pendingApprovals.totalAmount, { currency, locale })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Awaiting management verification & sign-off
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 6. Overdue Invoices / Action Status */}
        <Card className="border-border/80 shadow-xs">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <AlertCircle
                  className={cn(
                    'w-4 h-4',
                    overdue.count > 0 ? 'text-destructive' : 'text-emerald-500',
                  )}
                />
                <span>Overdue Invoices</span>
              </div>
              <Badge
                variant={overdue.count > 0 ? 'destructive' : 'success'}
                className="text-[11px]"
              >
                {overdue.count > 0 ? `${overdue.count} overdue` : 'All settled'}
              </Badge>
            </div>

            <div className="space-y-1">
              <div className="text-2xl font-bold tracking-tight text-foreground font-mono tabular-nums">
                {overdue.count > 0
                  ? formatCurrency(overdue.totalAmount, { currency, locale })
                  : formatCurrency(0, { currency, locale })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {overdue.count > 0
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
