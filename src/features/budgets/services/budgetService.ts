import { apiClient } from '@/api/client'
import { z } from 'zod'
import { budgetPeriodResponseSchema, budgetResponseSchema } from '../schemas/budgetResponseSchema'
import type {
  Budget,
  BudgetCreateRequest,
  BudgetPeriod,
  BudgetPeriodUpdateRequest,
} from '../types'

const BASE = '/v1/budgets'

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
