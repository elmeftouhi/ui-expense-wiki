/**
 * Budget endpoint contracts. Responses are validated by budgetResponseSchema;
 * the bundled OpenAPI document does not yet contain budget schemas.
 */

export type BudgetPeriodicity = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'

export type BudgetWarningType = 'AMOUNT' | 'PERCENTAGE'

export type BudgetPeriodStatus = 'OPEN' | 'CLOSED'

/** A concrete, dated instance of a budget (e.g. "October 2026"). Created lazily by the backend. */
export interface BudgetPeriod {
  id: number
  /** ISO date (yyyy-MM-dd) */
  startDate: string
  /** ISO date (yyyy-MM-dd) */
  endDate: string
  allocatedAmount: number
  spentAmount: number
  status: BudgetPeriodStatus
  warningType: BudgetWarningType
  warningThreshold: number
  warningSent?: boolean
  exceededSent?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Budget {
  id: number
  name: string
  description?: string | null
  periodicity: BudgetPeriodicity
  allocatedAmount: number
  warningType: BudgetWarningType
  warningThreshold: number
  active: boolean
  categoryIds: number[]
  tenantId?: number
  /** Null until the first matching expense creates the current period instance. */
  currentPeriod?: BudgetPeriod | null
  createdAt?: string
  updatedAt?: string
}

/** Payload for POST /v1/budgets and PUT /v1/budgets/{id} */
export interface BudgetCreateRequest {
  name: string
  description?: string
  periodicity: BudgetPeriodicity
  allocatedAmount: number
  warningType: BudgetWarningType
  warningThreshold: number
  categoryIds: number[]
  active: boolean
}

/** Payload for PATCH /v1/budgets/{id}/periods/{periodId} */
export interface BudgetPeriodUpdateRequest {
  allocatedAmount: number
  warningType: BudgetWarningType
  warningThreshold: number
}

/** UI-derived health of a period, computed client-side from spent vs. thresholds. */
export type BudgetHealth = 'NO_PERIOD' | 'ON_TRACK' | 'WARNING' | 'EXCEEDED'

export interface BudgetPeriodSummary {
  allocated: number
  spent: number
  /** May be negative when the period is over budget. */
  remaining: number
  /** spent / allocated * 100 (unclamped) */
  consumedPercent: number
  /** Absolute spend amount at which the warning fires. */
  warningAt: number
  health: Exclude<BudgetHealth, 'NO_PERIOD'>
}
