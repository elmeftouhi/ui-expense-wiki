import React from 'react'
import { Plus, Download, PiggyBank } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useActiveTenant } from '@/features/tenants'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  MetricsOverview,
  SpendingTrendChart,
  UpcomingExpensesCard,
  CategoryBreakdownCard,
  getDashboardDataForTenant,
} from '@/features/dashboard'
import { BudgetConsumptionWidget } from '@/features/budgets'

export const DashboardPage: React.FC = () => {
  const { activeTenant, canEdit } = useActiveTenant()

  // KPI, upcoming expense, and category cards still use demo data.
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

        <div className="flex items-center gap-2.5">
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
      <MetricsOverview
        kpis={dashboardData.kpis}
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
            categories={dashboardData.categoryBreakdown}
            currency={activeTenant.currency}
            locale={activeTenant.locale}
          />
        </div>
      </div>
    </div>
  )
}
