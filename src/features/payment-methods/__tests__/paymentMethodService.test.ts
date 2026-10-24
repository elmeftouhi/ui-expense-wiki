import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { PAYMENT_METHOD_TYPES, paymentMethodRequestSchema, paymentMethodService } from '../paymentMethodService'
import { expenseService } from '@/features/expenses/services/expenseService'
import { subscriptionService } from '@/features/subscriptions/services/subscriptionService'
import { expense } from '@/features/expenses/__tests__/expenseFixtures'
import { subscription } from '@/features/subscriptions/__tests__/fixtures'

const method = { id: 1, name: 'Cash', type: 'CASH' as const, active: true, isDefault: true }
const payload = { name: 'Cash', type: 'CASH' as const, active: true, isDefault: true }
afterEach(() => vi.restoreAllMocks())

describe('payment method API', () => {
  it('lists active or inactive methods with an explicit tenant header', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue([method])
    expect(await paymentMethodService.list(101, true)).toEqual([method])
    expect(get).toHaveBeenCalledWith('/v1/payment-methods', { tenantId: 101, params: { showInactive: true } })
    await paymentMethodService.list(102)
    expect(get).toHaveBeenLastCalledWith('/v1/payment-methods', { tenantId: 102, params: { showInactive: false } })
  })

  it('creates, updates, deactivates, and sets the default using supported routes', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(method)
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue(method)
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue(method)
    await paymentMethodService.create(101, { ...payload, name: ' Cash ' })
    expect(post).toHaveBeenCalledWith('/v1/payment-methods', payload, { tenantId: 101 })
    await paymentMethodService.update(101, 1, { ...payload, isDefault: false, active: false })
    expect(put).toHaveBeenCalledWith('/v1/payment-methods/1', { ...payload, isDefault: false, active: false }, { tenantId: 101 })
    await paymentMethodService.setDefault(101, 1)
    expect(patch).toHaveBeenCalledWith('/v1/payment-methods/1/set-default', undefined, { tenantId: 101 })
  })

  it('accepts every supported type and rejects blank names or inactive defaults', () => {
    for (const type of PAYMENT_METHOD_TYPES) expect(paymentMethodRequestSchema.safeParse({ ...payload, type }).success).toBe(true)
    expect(paymentMethodRequestSchema.safeParse({ ...payload, name: ' ' }).success).toBe(false)
    expect(paymentMethodRequestSchema.safeParse({ ...payload, type: 'WIRE' }).success).toBe(false)
    expect(paymentMethodRequestSchema.safeParse({ ...payload, active: false }).success).toBe(false)
  })

  it('surfaces malformed responses and request failures', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([{ ...method, type: 'INVALID' }])
    await expect(paymentMethodService.list(101)).rejects.toThrow('invalid payment method data')
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Connection lost'))
    await expect(paymentMethodService.list(101)).rejects.toThrow('Connection lost')
  })
})

describe('payment method list filtering', () => {
  it('filters all expense pages before paginating, preserving other server filters', async () => {
    const get = vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ content: [{ ...expense, id: 1, paymentMethodId: 2 }], page: 0, size: 100, totalPages: 2, totalElements: 3 })
      .mockResolvedValueOnce({ content: [{ ...expense, id: 2, paymentMethodId: 1 }, { ...expense, id: 3, paymentMethodId: 2 }], page: 1, size: 100, totalPages: 2, totalElements: 3 })
    const result = await expenseService.list({ paymentMethodId: 2, categoryId: 3, year: 2026, month: 10, page: 1, size: 1, sort: 'dueDate', direction: 'desc' })
    expect(result).toMatchObject({ page: 1, size: 1, totalElements: 2, totalPages: 2, content: [{ id: 3 }] })
    expect(get).toHaveBeenNthCalledWith(2, '/v1/expenses', { params: { year: 2026, month: 10, categoryId: 3, page: 1, size: 100, sort: 'dueDate,desc' } })
  })

  it('filters subscription pages and recurring totals by ID, including historical inactive methods', async () => {
    const results = [
      { content: [{ ...subscription, id: 1, amount: 10, paymentMethodId: 2 }], page: 0, size: 100, totalPages: 2, totalElements: 3 },
      { content: [{ ...subscription, id: 2, amount: 15, paymentMethodId: 2 }, { ...subscription, id: 3, amount: 100, paymentMethodId: 1 }], page: 1, size: 100, totalPages: 2, totalElements: 3 },
    ]
    vi.spyOn(apiClient, 'get').mockImplementation(async (_url, options) => results[Number(options?.params?.page)])
    const result = await subscriptionService.list({ paymentMethodId: 2, status: 'ACTIVE', page: 1, size: 1, sort: 'name', direction: 'asc' })
    expect(result).toMatchObject({ totalElements: 2, totalPages: 2, content: [{ id: 2 }] })
    expect(await subscriptionService.recurringCosts({ paymentMethodId: 2, status: 'ACTIVE' }))
      .toEqual([{ currency: 'USD', monthly: 25, yearly: 300 }])
    expect(apiClient.get).toHaveBeenCalledTimes(4)
  })

  it('returns an empty page for unmatched methods and propagates later-page failures', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ content: [expense], page: 0, size: 100, totalPages: 1, totalElements: 1 })
    expect(await expenseService.list({ paymentMethodId: 999, page: 0, size: 10, sort: 'dueDate', direction: 'desc' }))
      .toMatchObject({ content: [], totalElements: 0, totalPages: 0 })
    vi.mocked(apiClient.get)
      .mockResolvedValueOnce({ content: [expense], page: 0, size: 100, totalPages: 2, totalElements: 2 })
      .mockRejectedValueOnce(new Error('Second page failed'))
    await expect(expenseService.list({ paymentMethodId: 1, page: 0, size: 10, sort: 'dueDate', direction: 'desc' })).rejects.toThrow('Second page failed')
  })
})
