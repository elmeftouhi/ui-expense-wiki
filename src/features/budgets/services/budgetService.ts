import { apiClient } from '@/api/client'
import { z } from 'zod'
import { budgetPeriodResponseSchema, budgetResponseSchema } from '../schemas/budgetResponseSchema'
import type {
  Budget,
  BudgetCreateRequest,
  BudgetPeriod,
  BudgetPeriodResponse,
  BudgetPeriodUpdateRequest,
} from '../types'

const BASE = '/v1/budgets'

/** Backend-accepted range for `monthsBack` on the history endpoint. */
export const BUDGET_HISTORY_MONTHS = { min: 1, max: 60, default: 12 } as const

export function isValidMonthsBack(value: number): boolean {
  return Number.isInteger(value) && value >= BUDGET_HISTORY_MONTHS.min && value <= BUDGET_HISTORY_MONTHS.max
}

function parseResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new Error('The server returned invalid budget data. Refresh the page or contact support.')
  }
  return result.data
}

export function normalizePeriod(raw: unknown): BudgetPeriod {
  return parseResponse(budgetPeriodResponseSchema, raw)
}

export function normalizeBudget(raw: unknown): Budget {
  return parseResponse(budgetResponseSchema, raw)
}

export const budgetService = {
  /**
   * List all budgets for the active tenant (each includes its current period, if one exists).
   * Endpoint: GET /v1/budgets
   */
  async getAll(): Promise<Budget[]> {
    return parseResponse(z.array(budgetResponseSchema), await apiClient.get<unknown>(BASE))
  },

  /**
   * Endpoint: GET /v1/budgets/{id}
   */
  async getById(id: number): Promise<Budget> {
    return normalizeBudget(await apiClient.get<unknown>(`${BASE}/${id}`))
  },

  /**
   * Endpoint: POST /v1/budgets
   */
  async create(payload: BudgetCreateRequest): Promise<Budget> {
    return normalizeBudget(await apiClient.post<unknown>(BASE, payload))
  },

  /**
   * Updates the budget definition (defaults used for future period instances).
   * Endpoint: PUT /v1/budgets/{id}
   */
  async update(id: number, payload: BudgetCreateRequest): Promise<Budget> {
    return normalizeBudget(await apiClient.put<unknown>(`${BASE}/${id}`, payload))
  },

  /**
   * Period history (lazily-created instances) for a budget.
   * Endpoint: GET /v1/budgets/{id}/periods
   */
  async getPeriods(id: number): Promise<BudgetPeriod[]> {
    return parseResponse(z.array(budgetPeriodResponseSchema), await apiClient.get<unknown>(`${BASE}/${id}/periods`))
  },

  /**
   * Month history (newest first). Spent amounts include PAID expenses only.
   * `monthsBack` is omitted when undefined so the backend default (12) applies.
   * Endpoint: GET /v1/budgets/{id}/history?monthsBack={n}
   */
  async getHistory(id: number, monthsBack?: number): Promise<BudgetPeriodResponse[]> {
    return parseResponse(
      z.array(budgetPeriodResponseSchema),
      await apiClient.get<unknown>(`${BASE}/${id}/history`, { params: { monthsBack } }),
    )
  },

  /**
   * Adjusts a single period instance's allocation and warning rule.
   * Endpoint: PATCH /v1/budgets/{id}/periods/{periodId}
   */
  async updatePeriod(
    id: number,
    periodId: number,
    payload: BudgetPeriodUpdateRequest,
  ): Promise<BudgetPeriod> {
    return normalizePeriod(
      await apiClient.patch<unknown>(`${BASE}/${id}/periods/${periodId}`, payload),
    )
  },
}

export function getBudgetHistory(budgetId: number, monthsBack?: number): Promise<BudgetPeriodResponse[]> {
  return budgetService.getHistory(budgetId, monthsBack)
}
