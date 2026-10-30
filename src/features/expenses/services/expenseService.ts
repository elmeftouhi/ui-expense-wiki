import { z } from 'zod'
import { apiClient } from '@/api/client'
import { loadPaymentMethodMatches } from '@/features/payment-methods/filterPaymentMethodPage'
import {
  expensePageResponseSchema,
  expenseResponseSchema,
  expenseStatisticsResponseSchema,
} from '../schemas/expenseResponseSchema'
import type {
  ExpenseListFilters,
  ExpensePageResponse,
  ExpenseResponse,
  ExpenseStatisticsFilters,
  ExpenseStatisticsResponse,
  ExpenseStatusChangeRequest,
  ExpenseUpsertRequest,
} from '../types'

const BASE = '/v1/expenses'

function parseResponse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new Error('The server returned invalid expense data. Refresh the page or contact support.')
  }
  return result.data
}

export function buildExpenseListParams(filters: ExpenseListFilters): Record<string, string | number> {
  return {
    ...(filters.year ? { year: filters.year } : {}),
    ...(filters.year && filters.month ? { month: filters.month } : {}),
    ...(filters.search?.trim() ? { search: filters.search.trim() } : {}),
    ...(filters.categoryIds?.length ? { categoryIds: filters.categoryIds.join(',') } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    page: filters.page,
    size: filters.size,
    sort: `${filters.sort},${filters.direction}`,
  }
}

export const expenseService = {
  async list(filters: ExpenseListFilters): Promise<ExpensePageResponse> {
    if (filters.paymentMethodId !== undefined) {
      const matches = await loadPaymentMethodMatches<ExpenseResponse>(
        filters.paymentMethodId,
        (page, size) => expenseService.list({ ...filters, paymentMethodId: undefined, page, size }),
      )
      const content = matches.slice(filters.page * filters.size, (filters.page + 1) * filters.size)
      return {
        content,
        page: filters.page,
        size: filters.size,
        totalElements: matches.length,
        totalPages: Math.ceil(matches.length / filters.size),
        filteredTotalAmount: matches.reduce((total, expense) => total + expense.amount, 0),
        recordsCount: content.length,
      }
    }
    return parseResponse(
      expensePageResponseSchema,
      await apiClient.get<unknown>(BASE, { params: buildExpenseListParams(filters) }),
    )
  },

  async getById(id: number): Promise<ExpenseResponse> {
    return parseResponse(expenseResponseSchema, await apiClient.get<unknown>(`${BASE}/${id}`))
  },

  async create(payload: ExpenseUpsertRequest): Promise<ExpenseResponse> {
    return parseResponse(expenseResponseSchema, await apiClient.post<unknown>(BASE, payload))
  },

  async update(id: number, payload: ExpenseUpsertRequest): Promise<ExpenseResponse> {
    return parseResponse(expenseResponseSchema, await apiClient.put<unknown>(`${BASE}/${id}`, payload))
  },

  async delete(id: number): Promise<void> {
    await apiClient.del<void>(`${BASE}/${id}`)
  },

  async changeStatus(id: number, payload: ExpenseStatusChangeRequest): Promise<ExpenseResponse> {
    const raw = await apiClient.patch<unknown>(`${BASE}/${id}/status`, payload)
    return raw === undefined
      ? this.getById(id)
      : parseResponse(expenseResponseSchema, raw)
  },

  async markAsPaid(id: number, paidDate: string): Promise<ExpenseResponse> {
    const raw = await apiClient.patch<unknown>(`${BASE}/${id}/mark-as-paid`, undefined, { params: { paidDate } })
    return raw === undefined
      ? this.getById(id)
      : parseResponse(expenseResponseSchema, raw)
  },

  async overdue(): Promise<ExpenseResponse[]> {
    return parseResponse(z.array(expenseResponseSchema), await apiClient.get<unknown>(`${BASE}/overdue`))
  },

  async statistics(filters: ExpenseStatisticsFilters): Promise<ExpenseStatisticsResponse> {
    return parseResponse(
      expenseStatisticsResponseSchema,
      await apiClient.get<unknown>(`${BASE}/statistics`, {
        params: { startDate: filters.startDate, endDate: filters.endDate },
      }),
    )
  },
}
