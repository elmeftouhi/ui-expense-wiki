import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient, ApiClientError } from '@/api/client'
import { budgetService, getBudgetHistory, isValidMonthsBack, normalizeBudget } from '../services/budgetService'
import { budget, payload, period } from './fixtures'

afterEach(() => vi.restoreAllMocks())

describe('budget API service', () => {
  it('lists budgets and converts serialized decimal strings', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue([{
      ...budget, allocatedAmount: '1000.50',
      currentPeriod: { ...period, spentAmount: '850.25' },
    }])
    const result = await budgetService.getAll()
    expect(get).toHaveBeenCalledWith('/v1/budgets')
    expect(result[0].allocatedAmount).toBe(1000.5)
    expect(result[0].currentPeriod?.spentAmount).toBe(850.25)
  })

  it('loads budget details and period history', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(budget).mockResolvedValueOnce([period])
    expect(await budgetService.getById(1)).toEqual(budget)
    expect(await budgetService.getPeriods(1)).toEqual([period])
    expect(get.mock.calls.map(([path]) => path)).toEqual(['/v1/budgets/1', '/v1/budgets/1/periods'])
  })

  it('posts and puts the complete budget payload', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue(budget)
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue(budget)
    await budgetService.create(payload)
    await budgetService.update(1, payload)
    expect(post).toHaveBeenCalledWith('/v1/budgets', payload)
    expect(put).toHaveBeenCalledWith('/v1/budgets/1', payload)
  })

  it('patches only the allocation and warning rule for the specified period', async () => {
    const patch = vi.spyOn(apiClient, 'patch').mockResolvedValue(period)
    const update = { allocatedAmount: 1200, warningType: 'AMOUNT' as const, warningThreshold: 900 }
    await budgetService.updatePeriod(1, 10, update)
    expect(patch).toHaveBeenCalledWith('/v1/budgets/1/periods/10', update)
  })

  it.each([null, undefined, {}, { ...budget, allocatedAmount: '' }, { ...budget, allocatedAmount: 'bad' }])(
    'reports malformed responses rather than showing a zero balance: %o', (raw) => {
      expect(() => normalizeBudget(raw)).toThrow('invalid budget data')
    },
  )

  it('does not disguise a failed or invalid list response as an empty list', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('Offline'))
    await expect(budgetService.getAll()).rejects.toThrow('invalid budget data')
    await expect(budgetService.getAll()).rejects.toThrow('Offline')
  })
})

describe('getBudgetHistory', () => {
  it('requests history with monthsBack as a query param and normalizes decimals', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue([{ ...period, spentAmount: '12.50' }])
    const result = await getBudgetHistory(1, 6)
    expect(get).toHaveBeenCalledWith('/v1/budgets/1/history', { params: { monthsBack: 6 } })
    expect(result).toEqual([{ ...period, spentAmount: 12.5 }])
  })

  it('omits monthsBack when not provided so the backend default applies', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue([])
    expect(await getBudgetHistory(7)).toEqual([])
    expect(get).toHaveBeenCalledWith('/v1/budgets/7/history', { params: { monthsBack: undefined } })
  })

  it('builds the final URL without an empty monthsBack param', async () => {
    const fetchMock = vi.fn().mockImplementation(async () =>
      new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    try {
      await getBudgetHistory(3)
      await getBudgetHistory(3, 24)
      const urls = fetchMock.mock.calls.map(([url]) => new URL(String(url)))
      expect(urls[0].pathname).toMatch(/\/v1\/budgets\/3\/history$/)
      expect(urls[0].searchParams.has('monthsBack')).toBe(false)
      expect(urls[1].searchParams.get('monthsBack')).toBe('24')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('propagates 400 errors for an invalid monthsBack', async () => {
    vi.spyOn(apiClient, 'get').mockRejectedValue(new ApiClientError('Bad request', 400))
    await expect(getBudgetHistory(1, 99)).rejects.toMatchObject({ status: 400 })
  })

  it('rejects malformed history payloads', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue([{ ...period, status: 'UNKNOWN' }])
    await expect(getBudgetHistory(1)).rejects.toThrow('invalid budget data')
  })

  it.each([[1, true], [60, true], [0, false], [61, false], [2.5, false], [Number.NaN, false]])(
    'validates monthsBack %s → %s', (value, expected) => {
      expect(isValidMonthsBack(value)).toBe(expected)
    },
  )
})
