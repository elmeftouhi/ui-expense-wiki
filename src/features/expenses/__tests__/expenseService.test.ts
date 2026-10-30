import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { buildExpenseListParams, expenseService } from '../services/expenseService'
import type { ExpenseListFilters } from '../types'
import { expense, expenseStatistics } from './expenseFixtures'

afterEach(() => vi.restoreAllMocks())

const filters: ExpenseListFilters = {
  year: 2025,
  month: 2,
  categoryIds: [3, 5],
  type: 'SUBSCRIPTION',
  page: 1,
  size: 20,
  sort: 'dueDate',
  direction: 'asc',
}

describe('expense API service', () => {
  it('sends status with server pagination and omits it when cleared', async () => {
    const response = { content: [expense], page: 1, size: 20, totalPages: 3, totalElements: 42 }
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(response)
    for (const status of ['PAID', 'PENDING'] as const) {
      await expect(expenseService.list({ ...filters, status })).resolves.toEqual(response)
      expect(get).toHaveBeenLastCalledWith('/v1/expenses', {
        params: { year: 2025, month: 2, categoryIds: '3,5', type: 'SUBSCRIPTION', status, page: 1, size: 20, sort: 'dueDate,asc' },
      })
    }
    await expenseService.list(filters)
    expect(get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: { year: 2025, month: 2, categoryIds: '3,5', type: 'SUBSCRIPTION', page: 1, size: 20, sort: 'dueDate,asc' },
    })
    expect(get).toHaveBeenCalledTimes(3)
  })

  it('preserves status on every page when combining with a payment method filter', async () => {
    const paid = { ...expense, id: 8, status: 'PAID' }
    const otherPaid = { ...paid, id: 9, paymentMethodId: 2 }
    const get = vi.spyOn(apiClient, 'get').mockImplementation(async (_url, options) => ({
      content: options?.params?.page === 0
        ? [paid]
        : [otherPaid, { ...paid, id: 11 }],
      page: options?.params?.page, size: 100, totalPages: 2, totalElements: 3,
    }))

    const page = await expenseService.list({ ...filters, search: 'bill', status: 'PAID', paymentMethodId: 1, page: 1, size: 1 })
    expect(page).toMatchObject({ content: [{ id: 11 }], page: 1, size: 1, totalElements: 2, totalPages: 2 })
    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenNthCalledWith(1, '/v1/expenses', {
      params: { year: 2025, month: 2, categoryIds: '3,5', search: 'bill', type: 'SUBSCRIPTION', status: 'PAID', page: 0, size: 100, sort: 'dueDate,asc' },
    })
    expect(get).toHaveBeenNthCalledWith(2, '/v1/expenses', {
      params: expect.objectContaining({ search: 'bill', categoryIds: '3,5', status: 'PAID', page: 1, size: 100 }),
    })

    const combined = await expenseService.list({ ...filters, status: 'PAID', paymentMethodId: 1, page: 0 })
    expect(combined.content.map((item) => item.id)).toEqual([8, 11])
    expect(combined.totalElements).toBe(2)
    const empty = await expenseService.list({ ...filters, status: 'PAID', paymentMethodId: 99, page: 0 })
    expect(empty).toMatchObject({ content: [], totalElements: 0, totalPages: 0 })
  })

  it('surfaces failures from later pages when combining status and payment method filters', async () => {
    vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ content: [expense], page: 0, size: 100, totalPages: 2, totalElements: 2 })
      .mockRejectedValueOnce(new Error('Could not load next page'))
    await expect(expenseService.list({ ...filters, status: 'PENDING', paymentMethodId: 1 }))
      .rejects.toThrow('Could not load next page')
  })

  it('serializes supported filters and pageable sort fields', () => {
    expect(buildExpenseListParams(filters)).toEqual({
      year: 2025, month: 2, categoryIds: '3,5', type: 'SUBSCRIPTION',
      page: 1, size: 20, sort: 'dueDate,asc',
    })
    expect(buildExpenseListParams({ ...filters, year: undefined, month: 2 })).not.toHaveProperty('month')
  })

  it('sends trimmed search and omits empty search and category selections', () => {
    expect(buildExpenseListParams({ ...filters, search: '  electricity bill  ' })).toMatchObject({
      search: 'electricity bill', categoryIds: '3,5',
    })
    const params = buildExpenseListParams({ ...filters, search: '   ', categoryIds: [] })
    expect(params).not.toHaveProperty('search')
    expect(params).not.toHaveProperty('categoryIds')
    expect(params).not.toHaveProperty('categoryId')
    expect(buildExpenseListParams({ ...filters, categoryIds: undefined })).not.toHaveProperty('categoryIds')
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

  it('preserves nested category statistics without budget or percentage fields', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(expenseStatistics)
    await expect(expenseService.statistics({ startDate: '2025-02-01', endDate: '2025-02-28' }))
      .resolves.toEqual(expenseStatistics)
  })

  it('parses decimal strings at every category depth and rejects invalid nested data', async () => {
    const raw = {
      ...expenseStatistics,
      byCategory: [{
        categoryId: '10', categoryName: 'Food', total: '650', parentTotal: null,
        subCategories: [{
          categoryId: '11', categoryName: 'Groceries', total: '420', parentTotal: '650',
          subCategories: [{
            categoryId: '13', categoryName: 'Produce', total: '210', parentTotal: '420', subCategories: [],
          }],
        }],
      }],
    }
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(raw)
    const filters = { startDate: '2025-02-01', endDate: '2025-02-28' }
    const result = await expenseService.statistics(filters)
    expect(result.byCategory[0].subCategories[0]).toMatchObject({ total: 420, parentTotal: 650 })
    expect(result.byCategory[0].subCategories[0].subCategories[0]).toMatchObject({ total: 210, parentTotal: 420 })

    get.mockResolvedValue({
      ...raw,
      byCategory: [{ ...raw.byCategory[0], subCategories: [{ categoryId: 11, total: 'invalid' }] }],
    })
    await expect(expenseService.statistics(filters)).rejects.toThrow('The server returned invalid expense data.')
  })
})
