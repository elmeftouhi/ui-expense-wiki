import React, { useState, useRef, useEffect } from 'react'
import {
  Plus,
  PiggyBank,
  RefreshCw,
  AlertCircle,
  MoreHorizontal,
  BarChart3,
  PieChart,
  TrendingUp,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { useActiveTenant } from '@/features/tenants'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/api-error'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { MetricsOverview } from '../components/MetricsOverview'
import { SpendingTrendChart } from '../components/SpendingTrendChart'
import { CategoryBreakdownCard } from '../components/CategoryBreakdownCard'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { BudgetConsumptionWidget } from '@/features/budgets'
import { useExpenseStatistics } from '@/features/expenses'
import { currentMonthStatisticsRange } from '@/features/expenses/utils/statisticsRange'

type MobileDashboardSection = 'trends' | 'categories' | 'budgets'

export const DashboardPage: React.FC = () => {
  const { activeTenant, canEdit } = useActiveTenant()
  const summary = useDashboardSummary(activeTenant.id)
  const statistics = useExpenseStatistics(currentMonthStatisticsRange())
  const isCompactLayout = useMediaQuery('(max-width: 1023px)', false)
  const [mobileSection, setMobileSection] = useState<MobileDashboardSection>('trends')
  const [moreActionsOpen, setMoreActionsOpen] = useState(false)
  const moreMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!moreActionsOpen) return
    function handleOutside(event: MouseEvent | TouchEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreActionsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [moreActionsOpen])

  const isRefreshing = summary.isRefreshing || statistics.isFetching
  const refresh = () => {
    if (isRefreshing) return
    summary.refresh()
    void statistics.refetch({ cancelRefetch: false })
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Compact Single-Row Header Bar */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
          Financial Overview
        </h1>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="h-8 sm:h-9 w-8 sm:w-auto p-0 sm:px-3 gap-1.5 text-xs"
            onClick={refresh}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            title={isRefreshing ? 'Refreshing...' : 'Refresh'}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
            <span className="sr-only sm:not-sr-only">
              {isRefreshing ? 'Refreshing...' : 'Refresh'}
            </span>
          </Button>

          {/* Desktop Quick Shortcuts */}
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex h-9 gap-1.5 text-xs">
            <Link to="/expenses/statistics">
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Statistics</span>
            </Link>
          </Button>

          <Button asChild variant="outline" size="sm" className="hidden md:inline-flex h-9 gap-1.5 text-xs">
            <Link to="/budgets">
              <PiggyBank className="w-3.5 h-3.5" />
              <span>Budgets</span>
            </Link>
          </Button>

          {canEdit && (
            <Button asChild size="sm" className="h-8 sm:h-9 px-2.5 sm:px-3 gap-1.5 text-xs">
              <Link to="/expenses/new">
                <Plus className="w-3.5 h-3.5" />
                <span>New Expense</span>
              </Link>
            </Button>
          )}

          {/* Mobile Overflow Menu for Secondary Links */}
          <div className="relative md:hidden" ref={moreMenuRef}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 sm:h-9 w-8 sm:w-9 p-0"
              aria-label="More dashboard actions"
              aria-expanded={moreActionsOpen}
              aria-haspopup="menu"
              onClick={() => setMoreActionsOpen((prev) => !prev)}
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>

            {moreActionsOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-xl z-40 text-xs space-y-0.5"
              >
                <Link
                  to="/budgets"
                  role="menuitem"
                  onClick={() => setMoreActionsOpen(false)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-accent transition-colors"
                >
                  <PiggyBank className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Manage budgets</span>
                </Link>
                <Link
                  to="/expenses/statistics"
                  role="menuitem"
                  onClick={() => setMoreActionsOpen(false)}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-accent transition-colors sm:hidden"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Full statistics</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Non-blocking Summary Error Banner */}
      {summary.error && !summary.isRefreshing && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3.5 py-2.5 text-xs sm:text-sm text-destructive"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {summary.data ? 'Could not refresh the dashboard summary; showing last loaded values. ' : 'Dashboard summary could not be loaded. '}
              {getApiErrorMessage(summary.error)}
            </span>
          </div>
          <Button variant="outline" size="sm" className="h-7 text-xs shrink-0 self-end sm:self-auto" onClick={summary.refresh}>
            Retry
          </Button>
        </div>
      )}

      {/* Unified Compact Ledger Sheet */}
      <MetricsOverview
        summary={summary.data}
        isLoading={summary.isLoading}
        currency={activeTenant.currency}
        locale={activeTenant.locale}
      />

      {/* Analytics & Breakdowns: Mobile Segmented Switcher (< lg) vs 3-Column Grid (lg+) */}
      {isCompactLayout ? (
        <div className="space-y-3">
          <div
            role="tablist"
            aria-label="Dashboard sections"
            className="grid grid-cols-3 p-1 rounded-xl bg-muted/60 border border-border/60 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mobileSection === 'trends'}
              onClick={() => setMobileSection('trends')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer',
                mobileSection === 'trends'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <TrendingUp className="w-3.5 h-3.5 shrink-0" />
              <span>Trends</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mobileSection === 'categories'}
              onClick={() => setMobileSection('categories')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer',
                mobileSection === 'categories'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <PieChart className="w-3.5 h-3.5 shrink-0" />
              <span>Categories</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={mobileSection === 'budgets'}
              onClick={() => setMobileSection('budgets')}
              className={cn(
                'flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg font-medium transition-all cursor-pointer',
                mobileSection === 'budgets'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <PiggyBank className="w-3.5 h-3.5 shrink-0" />
              <span>Budgets</span>
            </button>
          </div>

          <div role="tabpanel">
            {mobileSection === 'trends' && (
              <SpendingTrendChart
                tenantId={activeTenant.id}
                currency={activeTenant.currency}
                locale={activeTenant.locale}
              />
            )}
            {mobileSection === 'categories' && (
              <CategoryBreakdownCard
                statistics={statistics.data}
                isLoading={statistics.isLoading}
                error={statistics.error}
                onRetry={() => void statistics.refetch({ cancelRefetch: false })}
                isFetching={statistics.isFetching}
                currency={activeTenant.currency}
                locale={activeTenant.locale}
              />
            )}
            {mobileSection === 'budgets' && (
              <BudgetConsumptionWidget
                currency={activeTenant.currency}
                locale={activeTenant.locale}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          <div className="lg:col-span-2">
            <SpendingTrendChart
              tenantId={activeTenant.id}
              currency={activeTenant.currency}
              locale={activeTenant.locale}
            />
          </div>

          <div className="lg:col-span-1 space-y-5">
            <BudgetConsumptionWidget
              currency={activeTenant.currency}
              locale={activeTenant.locale}
            />

            <CategoryBreakdownCard
              statistics={statistics.data}
              isLoading={statistics.isLoading}
              error={statistics.error}
              onRetry={() => void statistics.refetch({ cancelRefetch: false })}
              isFetching={statistics.isFetching}
              currency={activeTenant.currency}
              locale={activeTenant.locale}
            />
          </div>
        </div>
      )}
    </div>
  )
}
