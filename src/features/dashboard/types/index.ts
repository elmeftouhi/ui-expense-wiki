/**
 * Dashboard metrics, reporting, and KPI data contract models.
 * Prepared for future Recharts and backend statistics endpoints.
 */

export type TrendDirection = 'up' | 'down' | 'neutral'

export interface PeriodComparison {
  currentAmount: number
  previousAmount: number
  difference: number
  percentageChange: number
  trend: TrendDirection
  periodLabel: string
}

export interface UpcomingExpenseItem {
  id: string | number
  title: string
  category: string
  dueDate: string
  amount: number
  vendor: string
  isRecurring: boolean
  status: 'SCHEDULED' | 'PENDING' | 'AUTO_PAY'
}

export interface DashboardKpiMetrics {
  thisMonth: PeriodComparison
  thisYear: PeriodComparison
  upcomingExpenses: {
    totalAmount: number
    count: number
    nextDueDate?: string
    nextItemTitle?: string
  }
  pendingApprovals: {
    totalAmount: number
    count: number
  }
  budgetUtilization: {
    monthlyBudget: number
    spent: number
    remaining: number
    percentage: number
  }
  overdue: {
    totalAmount: number
    count: number
  }
}

export interface ExpenseTimeSeriesPoint {
  date: string
  total: number
  budget?: number
}

export interface CategoryBreakdownPoint {
  categoryId: number | string
  categoryName: string
  amount: number
  color: string
  percentage: number
}

export interface MonthlyTrendPoint {
  month: string
  currentYear: number
  previousYear: number
  budget?: number
}

export interface DailyTrendPoint {
  day: number
  date: string
  label: string
  total: number
  transactions?: number
}

export interface MonthlyDataPoint {
  month: string
  shortMonth: string
  monthIndex: number
  amount: number
  previousYearAmount?: number
  budget?: number
}

export interface DashboardData {
  tenantId: number | string
  currency: string
  kpis: DashboardKpiMetrics
  upcomingList: UpcomingExpenseItem[]
  monthlyTrends: MonthlyTrendPoint[]
  categoryBreakdown: CategoryBreakdownPoint[]
  dailyDataByMonth?: Record<string, DailyTrendPoint[]>
  monthlyDataByYear?: Record<number, MonthlyDataPoint[]>
}
