/**
 * LEGACY mock-dashboard budget models.
 *
 * These types power the mock-data `BudgetConsumptionWidget` on the Dashboard until the
 * dashboard is migrated to live API data. New budget code must use the API models in
 * `./index.ts` instead.
 */

export type LegacyBudgetPeriod = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'

export type BudgetConsumingStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXCEEDED'

export interface Budget {
  id: string | number
  tenantId: string | number
  name: string
  categoryId: string | number
  categoryName: string
  period: LegacyBudgetPeriod
  periodLabel: string
  allocatedAmount: number
  spentAmount: number
  remainingAmount: number
  consumedPercentage: number
  consumingStatus: BudgetConsumingStatus
  warningThreshold: number // percentage e.g. 75
  criticalThreshold: number // percentage e.g. 90
  startDate: string
  endDate: string
  description?: string
  color: string
}

export interface BudgetMetricsSummary {
  totalAllocated: number
  totalSpent: number
  totalRemaining: number
  overallConsumptionPercentage: number
  activeBudgetsCount: number
  normalCount: number
  warningCount: number
  criticalCount: number
  exceededCount: number
  highestConsumedBudget?: {
    id: string | number
    name: string
    percentage: number
    spent: number
    allocated: number
  }
}
