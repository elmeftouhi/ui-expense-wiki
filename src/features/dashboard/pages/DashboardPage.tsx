import React from 'react'
import { Plus, Download, PiggyBank, RefreshCw, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useActiveTenant } from '@/features/tenants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { MetricsOverview } from '../components/MetricsOverview'
import { SpendingTrendChart } from '../components/SpendingTrendChart'
import { UpcomingExpensesCard } from '../components/UpcomingExpensesCard'
import { CategoryBreakdownCard } from '../components/CategoryBreakdownCard'
import { getDashboardDataForTenant } from '../data/mockDashboardData'
import { useDashboardSummary } from '../hooks/useDashboardSummary'
import { BudgetConsumptionWidget } from '@/features/budgets'
import { useExpenseStatistics } from '@/features/expenses'
import { currentMonthStatisticsRange } from '@/features/expenses/utils/statisticsRange'

export const DashboardPage: React.FC = () => {
  const { activeTenant, canEdit } = useActiveTenant()
  const summary = useDashboardSummary(activeTenant.id)
  const statistics = useExpenseStatistics(currentMonthStatisticsRange())
  const isRefreshing = summary.isRefreshing || statistics.isFetching
  const refresh = () => {
    if (isRefreshing) return
    summary.refresh()
    void statistics.refetch({ cancelRefetch: false })
  }

  // The upcoming expense list still uses demo data.
  const dashboardData = getDashboardDataForTenant(activeTenant.id)

  return (
    <div className="space-y-6">
      {/* Top Executive Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Financial Overview
            </h1>
            <Badge variant="outline" className="text-xs font-medium">
              {activeTenant.name}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time multi-tenant financial health, department budgets, and scheduled liabilities.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-xs"
            onClick={refresh}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </Button>

          <Button asChild variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
            <Link to="/budgets">
              <PiggyBank className="w-3.5 h-3.5" />
              <span>Manage Budgets</span>
            </Link>
          </Button>

          <Button variant="outline" size="sm" className="h-9 gap-1.5 text-xs">
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </Button>

          {canEdit && (
            <Button asChild size="sm" className="h-9 gap-1.5 text-xs">
              <Link to="/expenses">
                <Plus className="w-3.5 h-3.5" />
                <span>New Expense</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* SECTION 1: Financial Numbers & Core KPIs (including Monthly Budget & link) */}
      {summary.error && !summary.isRefreshing && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>
              {summary.data ? 'Could not refresh the dashboard summary; showing last loaded values. ' : 'Dashboard summary could not be loaded. '}
              {getApiErrorMessage(summary.error)}
            </span>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={summary.refresh}>
            Retry
          </Button>
        </div>
      )}

      <MetricsOverview
        summary={summary.data}
        isLoading={summary.isLoading}
        currency={activeTenant.currency}
        locale={activeTenant.locale}
      />

      {/* SECTION 2 & 3: Main Ledger Flow, Budget State & Category Allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column (2 cols): Expenditure Trends & Scheduled Liabilities */}
        <div className="lg:col-span-2 space-y-6">
          <SpendingTrendChart
            tenantId={activeTenant.id}
            currency={activeTenant.currency}
            locale={activeTenant.locale}
          />

          <UpcomingExpensesCard
            items={dashboardData.upcomingList}
            currency={activeTenant.currency}
            locale={activeTenant.locale}
          />
        </div>

        {/* Right Column (1 col): Departmental Budgets & Spending Allocation */}
        <div className="lg:col-span-1 space-y-6">
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
    </div>
  )
}
