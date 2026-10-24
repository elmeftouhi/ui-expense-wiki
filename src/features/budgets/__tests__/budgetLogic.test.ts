import { describe, expect, it } from 'vitest'
import { budgetFormSchema, periodUpdateSchema, toBudgetPayload } from '../schemas/budgetSchema'
import {
  formatPeriodLabel, getBudgetHealth, parseIsoDate, sortPeriodsDesc, summarizePeriod, summarizePortfolio,
} from '../utils/budgetMath'
import { flattenCategoryOptions } from '../utils/categoryOptions'
import { budget, payload, period } from './fixtures'

describe('budget validation', () => {
  it('trims names and descriptions and deduplicates selected categories', () => {
    const values = budgetFormSchema.parse({ ...payload, name: '  Cloud  ', description: '  ', categoryIds: [1, 1, 2] })
    expect(toBudgetPayload(values)).toEqual({
      ...payload, name: 'Cloud', categoryIds: [1, 2], description: undefined,
    })
  })

  it.each([
    { name: ' ' },
    { allocatedAmount: 0 },
    { allocatedAmount: -1 },
    { allocatedAmount: Infinity },
    { allocatedAmount: NaN },
    { warningThreshold: -1 },
    { warningThreshold: 100.01 },
    { categoryIds: [] },
    { categoryIds: [-1] },
    { periodicity: 'WEEKLY' },
  ])('rejects invalid budget values: %o', (invalid) => {
    expect(budgetFormSchema.safeParse({ ...payload, ...invalid }).success).toBe(false)
  })

  it.each([0, 80, 100])('accepts percentage threshold %s', (warningThreshold) => {
    expect(budgetFormSchema.safeParse({ ...payload, warningThreshold }).success).toBe(true)
  })

  it('does not impose the percentage cap on amount thresholds', () => {
    expect(budgetFormSchema.safeParse({
      ...payload, warningType: 'AMOUNT', warningThreshold: 2000,
    }).success).toBe(true)
  })

  it('applies the same numeric constraints to period adjustments', () => {
    expect(periodUpdateSchema.safeParse({ ...period, warningThreshold: 101 }).success).toBe(false)
    expect(periodUpdateSchema.safeParse({ ...period, allocatedAmount: 0 }).success).toBe(false)
    expect(periodUpdateSchema.safeParse({ ...period, warningThreshold: 100 }).success).toBe(true)
  })
})

describe('budget summaries', () => {
  it.each([
    [799.99, 'ON_TRACK'], [800, 'WARNING'], [1000, 'WARNING'], [1000.01, 'EXCEEDED'],
  ])('classifies spend %s as %s at exact boundaries', (spentAmount, health) => {
    expect(summarizePeriod({ ...period, spentAmount }).health).toBe(health)
  })

  it('uses absolute warning amounts and preserves negative remaining funds', () => {
    expect(summarizePeriod({
      ...period, warningType: 'AMOUNT', warningThreshold: 500, spentAmount: 1200,
    })).toMatchObject({ remaining: -200, warningAt: 500, consumedPercent: 120, health: 'EXCEEDED' })
  })

  it('does not fabricate a current period or allocation for an untouched budget', () => {
    const untouched = { ...budget, id: 2, currentPeriod: null }
    expect(getBudgetHealth(untouched)).toBe('NO_PERIOD')
    expect(summarizePortfolio([budget, untouched])).toMatchObject({
      totalBudgets: 2, trackedBudgets: 1, totalAllocated: 1000, totalSpent: 850, totalRemaining: 150,
      counts: { NO_PERIOD: 1, WARNING: 1 },
    })
  })

  it('sorts history newest first without changing the original array', () => {
    const older = { ...period, id: 11, startDate: '2026-09-01' }
    const original = [older, period]
    expect(sortPeriodsDesc(original)).toEqual([period, older])
    expect(original).toEqual([older, period])
  })

  it('formats calendar periods without UTC date shifts', () => {
    expect(parseIsoDate('2026-10-01').getDate()).toBe(1)
    expect(formatPeriodLabel(period, 'MONTHLY', 'en-US')).toBe('October 2026')
    expect(formatPeriodLabel(period, 'QUARTERLY', 'en-US')).toBe('Q4 2026')
    expect(formatPeriodLabel({ startDate: '2026-01-01', endDate: '2026-12-31' }, 'ANNUAL')).toBe('2026')
  })
})

describe('category options', () => {
  it('flattens nested categories without parent ids and deduplicates mixed responses', () => {
    const child = { id: 2, name: 'Hosting', active: true, allowOverBudget: false }
    const parent = { ...child, id: 1, name: 'Software', subCategories: [child] }
    expect(flattenCategoryOptions([parent, child])).toMatchObject([
      { id: 1, depth: 0 }, { id: 2, depth: 1, parentName: 'Software' },
    ])
  })
})
