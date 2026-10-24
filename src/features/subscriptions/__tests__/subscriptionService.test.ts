import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { buildDateOnlyQueryParams, subscriptionService } from '../services/subscriptionService'
import type { SubscriptionFilters } from '../types'
import { payment, subscription } from './fixtures'
import { DEFAULT_SUBSCRIPTION_FORM_VALUES, subscriptionFormSchema, toSubscriptionPayload } from '../schemas/subscriptionSchema'

afterEach(() => vi.restoreAllMocks())

const filters: SubscriptionFilters = {
  search: 'Design', status: 'ACTIVE', categoryId: 5, frequency: 'MONTHLY',
  nextBillingFrom: '2026-11-01', nextBillingTo: '2026-12-01',
  page: 2, size: 10, sort: 'nextBillingDate', direction: 'asc',
}

describe('independent subscription API service', () => {
  it('includes the selected paymentMethodId in create and update request bodies', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(subscription)
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue(subscription)
    const values = subscriptionFormSchema.parse({
      ...DEFAULT_SUBSCRIPTION_FORM_VALUES,
      name: subscription.name,
      categoryId: subscription.categoryId,
      amount: subscription.amount,
      nextBillingDate: subscription.nextBillingDate,
      paymentMethodId: 2,
    })

    await subscriptionService.create(toSubscriptionPayload(values))
    await subscriptionService.update(subscription.id, toSubscriptionPayload({ ...values, paymentMethodId: 3 }))

    expect(post).toHaveBeenCalledWith('/v1/subscriptions', expect.objectContaining({ paymentMethodId: 2 }))
    expect(put).toHaveBeenCalledWith(`/v1/subscriptions/${subscription.id}`, expect.objectContaining({ paymentMethodId: 3 }))
    expect(post.mock.calls[0][1]).not.toHaveProperty('paymentMethod')
    expect(put.mock.calls[0][1]).not.toHaveProperty('paymentMethod')
  })

  it('serializes category IDs for list and totals requests without the legacy single category parameter', async () => {
    expect(buildDateOnlyQueryParams({ ...filters, categoryIds: [5, 8, 9] })).toMatchObject({ categoryIds: '5,8,9' })
    expect(buildDateOnlyQueryParams({ ...filters, categoryIds: [5, 8, 9] })).not.toHaveProperty('categoryId')
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      content: [subscription], page: 0, size: 100, totalElements: 1, totalPages: 1,
    })
    await subscriptionService.recurringCosts({ categoryIds: [5, 9], status: 'ACTIVE' })
    expect(get).toHaveBeenCalledWith('/v1/subscriptions', {
      params: { categoryIds: '5,9', status: 'ACTIVE', page: 0, size: 100, sort: 'name,asc' },
    })
    expect(buildDateOnlyQueryParams({ ...filters, categoryId: undefined, categoryIds: [] })).not.toHaveProperty('categoryIds')
  })

  it('loads every matching page for filtered costs', async () => {
    const get = vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        content: [{ ...subscription, status: 'PAUSED', frequency: 'ANNUAL', amount: 120 }],
        page: 0, size: 1, totalElements: 2, totalPages: 2,
      })
      .mockResolvedValueOnce({
        content: [{ ...subscription, status: 'PAUSED', id: 13, frequency: 'SEMIANNUAL', amount: 60 }],
        page: 1, size: 1, totalElements: 2, totalPages: 2,
      })
    expect(await subscriptionService.recurringCosts({ search: 'Design', categoryId: 5, status: 'PAUSED' })).toEqual([{ currency: 'USD', monthly: 20, yearly: 240 }])
    expect(get.mock.calls).toEqual([0, 1].map((page) => [
      '/v1/subscriptions', { params: { search: 'Design', categoryId: 5, status: 'PAUSED', page, size: 100, sort: 'name,asc' } },
    ]))
  })

  it('fails recurring costs when any page fails instead of returning incomplete totals', async () => {
    vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ content: [subscription], page: 0, size: 100, totalElements: 101, totalPages: 2 })
      .mockRejectedValueOnce(new Error('Next page unavailable'))
    await expect(subscriptionService.recurringCosts()).rejects.toThrow('Next page unavailable')
  })

  it('serializes filters, page/sort parameters, and date-only values', () => {
    expect(buildDateOnlyQueryParams(filters)).toEqual({
      page: 2, size: 10, sort: 'nextBillingDate,asc', search: 'Design', status: 'ACTIVE',
      categoryId: 5, frequency: 'MONTHLY', nextBillingFrom: '2026-11-01', nextBillingTo: '2026-12-01',
    })
  })

  it('lists independent subscriptions using the requested JPQL sort field', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      content: [subscription], number: 2, size: 10, totalElements: 21, totalPages: 3,
    })
    expect(await subscriptionService.list(filters)).toMatchObject({ content: [subscription], page: 2, totalPages: 3 })
    expect(get).toHaveBeenCalledWith('/v1/subscriptions', { params: expect.objectContaining({ sort: 'nextBillingDate,asc' }) })
  })

  it('reads, creates, and updates through the independent subscription resource', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(subscription)
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(subscription)
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue(subscription)
    const payload = {
      name: subscription.name, categoryId: subscription.categoryId, amount: subscription.amount,
      frequency: subscription.frequency, nextBillingDate: subscription.nextBillingDate,
    }
    await subscriptionService.getById(12)
    await subscriptionService.create(payload)
    await subscriptionService.update(12, payload)
    expect(get).toHaveBeenCalledWith('/v1/subscriptions/12')
    expect(post).toHaveBeenCalledWith('/v1/subscriptions', payload)
    expect(put).toHaveBeenCalledWith('/v1/subscriptions/12', payload)
  })

  it('pauses, resumes with an explicit date, stops, and reads payment history', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(subscription)
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ content: [payment], page: 0, size: 10, totalElements: 1, totalPages: 1 })
    await subscriptionService.pause(12)
    await subscriptionService.resume(12, { nextBillingDate: '2026-12-05' })
    await subscriptionService.stop(12)
    expect(await subscriptionService.payments(12, { page: 0, size: 10, sort: 'scheduledBillingDate', direction: 'desc' })).toMatchObject({ content: [payment] })
    expect(post.mock.calls).toEqual([
      ['/v1/subscriptions/12/pause'],
      ['/v1/subscriptions/12/resume', { nextBillingDate: '2026-12-05' }],
      ['/v1/subscriptions/12/stop'],
    ])
    expect(get).toHaveBeenCalledWith('/v1/subscriptions/12/payments', {
      params: { page: 0, size: 10, sort: 'scheduledBillingDate,desc' },
    })
    expect(post.mock.calls.flat().join(' ')).not.toContain('/expenses/')
  })

  it('reads the explicit payment resource and normalizes numeric values', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ ...payment, id: '81', expenseId: '902', expenseAmount: '45.00' })
    expect(await subscriptionService.getPaymentById(81)).toEqual(payment)
    expect(get).toHaveBeenCalledWith('/v1/subscription-payments/81')
  })

  it('posts generate-next without a body and normalizes generated and duplicate results', async () => {
    const generated = {
      generated: true, alreadyExists: false, message: 'Next payment generated successfully',
      paymentId: 155, expenseId: 89, scheduledBillingDate: '2026-11-15',
    }
    const duplicate = { ...generated, generated: false, alreadyExists: true, paymentId: 153, message: 'A payment for this billing date already exists.' }
    const post = vi.spyOn(apiClient, 'post')
      .mockResolvedValueOnce({ ...generated, paymentId: '155', expenseId: '89' })
      .mockResolvedValueOnce(duplicate)
    expect(await subscriptionService.generateNextPayment(12)).toEqual(generated)
    expect(await subscriptionService.generateNextPayment(12)).toEqual(duplicate)
    expect(post.mock.calls).toEqual([
      ['/v1/subscriptions/12/payments/generate-next'],
      ['/v1/subscriptions/12/payments/generate-next'],
    ])
  })

  it('rejects a generate-next response that is neither generated nor existing', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({
      generated: false, alreadyExists: false, message: null, paymentId: 1, expenseId: 2, scheduledBillingDate: '2026-11-15',
    })
    await expect(subscriptionService.generateNextPayment(12)).rejects.toThrow('invalid subscription data')
  })

  it('rejects malformed payment data rather than treating it as empty history', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ ...payment, expenseId: undefined })
    await expect(subscriptionService.getPaymentById(81)).rejects.toThrow('invalid subscription data')
  })

  it('reloads lifecycle state when a successful action has no response body', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(undefined)
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({ ...subscription, status: 'PAUSED' })
    expect(await subscriptionService.pause(12)).toMatchObject({ status: 'PAUSED' })
    expect(post).toHaveBeenCalledWith('/v1/subscriptions/12/pause')
    expect(get).toHaveBeenCalledWith('/v1/subscriptions/12')
  })

  it('rejects malformed page data instead of reporting an empty list', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(null)
    await expect(subscriptionService.list(filters)).rejects.toThrow('invalid subscription data')
  })
})
