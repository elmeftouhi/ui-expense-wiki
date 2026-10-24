import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { buildExpenseListParams, expenseService } from '../services/expenseService'
import type { ExpenseListFilters } from '../types'
import { expense } from './expenseFixtures'

afterEach(() => vi.restoreAllMocks())

const filters: ExpenseListFilters = {
  year: 2025,
  month: 2,
  categoryId: 3,
  type: 'SUBSCRIPTION',
  page: 1,
  size: 20,
  sort: 'dueDate',
  direction: 'asc',
}

describe('expense API service', () => {
  it('serializes supported filters and pageable sort fields', () => {
    expect(buildExpenseListParams(filters)).toEqual({
      year: 2025, month: 2, categoryId: 3, type: 'SUBSCRIPTION',
      page: 1, size: 20, sort: 'dueDate,asc',
    })
    expect(buildExpenseListParams({ ...filters, year: undefined, month: 2 })).not.toHaveProperty('month')
  })

  it('uses the expense resource for CRUD and lifecycle actions', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(expense)
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(expense)
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue(expense)
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue(expense)
    const del = vi.spyOn(apiClient, 'del').mockResolvedValue(undefined)
    const payload = { categoryId: 3, description: expense.description, amount: 82.5, dueDate: expense.dueDate }

    await expenseService.getById(7)
    await expenseService.create(payload)
    await expenseService.update(7, payload)
    await expenseService.delete(7)
    await expenseService.changeStatus(7, { status: 'PAID', paidDate: '2025-02-02' })
    await expenseService.markAsPaid(7, '2025-02-02')

    expect(get).toHaveBeenCalledWith('/v1/expenses/7')
    expect(post).toHaveBeenCalledWith('/v1/expenses', payload)
    expect(put).toHaveBeenCalledWith('/v1/expenses/7', payload)
    expect(del).toHaveBeenCalledWith('/v1/expenses/7')
    expect(patch).toHaveBeenNthCalledWith(1, '/v1/expenses/7/status', { status: 'PAID', paidDate: '2025-02-02' })
    expect(patch).toHaveBeenNthCalledWith(2, '/v1/expenses/7/mark-as-paid', undefined, { params: { paidDate: '2025-02-02' } })
  })

  it('loads overdue and date-range statistics from their dedicated endpoints', async () => {
    const get = vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce([expense])
      .mockResolvedValueOnce({
        totalExpenses: 82.5, totalPaid: 0, totalPending: 82.5, totalOverdue: 0,
        overdueCount: 0, pendingCount: 1, byCategory: [],
      })
    expect(await expenseService.overdue()).toEqual([expense])
    expect(await expenseService.statistics({ startDate: '2025-02-01', endDate: '2025-02-28' })).toMatchObject({ totalPending: 82.5 })
    expect(get).toHaveBeenNthCalledWith(1, '/v1/expenses/overdue')
    expect(get).toHaveBeenNthCalledWith(2, '/v1/expenses/statistics', { params: { startDate: '2025-02-01', endDate: '2025-02-28' } })
  })

  it('reloads expense after a successful status mutation with no response body', async () => {
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue(undefined)
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(expense)
    await expect(expenseService.markAsPaid(7, '2025-02-02')).resolves.toEqual(expense)
    expect(patch).toHaveBeenCalledOnce()
    expect(get).toHaveBeenCalledWith('/v1/expenses/7')
  })
})
