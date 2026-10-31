import { describe, expect, it } from 'vitest'
import { expenseFormSchema, toExpensePayload, expenseStatusChangeSchema, toExpenseStatusPayload } from '../schemas/expenseSchema'
import { expenseResponseSchema, expensePageResponseSchema } from '../schemas/expenseResponseSchema'
import {
  buildExpenseUrlSearchParams,
  countActiveOptionalFilters,
  defaultExpenseFilters,
  parseExpenseSearchParams,
  shiftYearMonth,
} from '../utils/expenseListParams'
import { getExpenseDateCue, groupExpensesByDate } from '../utils/dateGroups'
import { expense } from './expenseFixtures'

const validForm = {
  categoryId: 3,
  description: ' Electricity bill ',
  amount: 82.5,
  dueDate: '2025-02-10',
  paidDate: '',
  type: 'SUBSCRIPTION' as const,
  paymentMethodId: 2,
  notes: '  ',
}

describe('expense form contracts', () => {
  it('requires a category, positive amount, and date-only due date, but not a description', () => {
    expect(expenseFormSchema.safeParse(validForm).success).toBe(true)
    for (const invalid of [
      { categoryId: 0 }, { amount: 0 }, { amount: -1 }, { dueDate: '02/10/2025' },
    ]) {
      expect(expenseFormSchema.safeParse({ ...validForm, ...invalid }).success).toBe(false)
    }
  })

  it('trims optional text and preserves date-only values in the write DTO', () => {
    expect(toExpensePayload(expenseFormSchema.parse(validForm), 'Utilities')).toEqual({
      categoryId: 3,
      description: 'Electricity bill',
      amount: 82.5,
      dueDate: '2025-02-10',
      paidDate: null,
      type: 'SUBSCRIPTION',
      paymentMethodId: 2,
      notes: null,
    })
  })

  it('uses the category name for blank descriptions and preserves custom descriptions', () => {
    const blank = expenseFormSchema.parse({ ...validForm, description: '   ' })
    expect(toExpensePayload(blank, ' Utilities ').description).toBe('Utilities')
    expect(toExpensePayload(blank, 'Groceries').description).toBe('Groceries')
    expect(toExpensePayload(validForm, 'Utilities').description).toBe('Electricity bill')
    expect(() => toExpensePayload(blank, '')).toThrow('Choose a category')
  })

  it('requires a paid date when status is PAID and clears it when leaving PAID', () => {
    expect(expenseStatusChangeSchema.safeParse({ status: 'PAID', paidDate: '' }).success).toBe(false)
    expect(toExpenseStatusPayload({ status: 'PAID', paidDate: '2025-02-02' })).toEqual({ status: 'PAID', paidDate: '2025-02-02' })
    expect(toExpenseStatusPayload({ status: 'PENDING', paidDate: '' }, 'PAID')).toEqual({ status: 'PENDING', paidDate: null })
  })
})

describe('expense response contracts', () => {
  it('preserves payment method IDs and displays the current API method name', () => {
    expect(expenseResponseSchema.parse({ ...expense, paymentMethodId: '2', paymentMethodName: 'Company card' }))
      .toMatchObject({ paymentMethodId: 2, paymentMethod: 'Company card', paymentMethodName: 'Company card' })
  })

  it('normalizes numeric strings and Spring pageable responses', () => {
    expect(expenseResponseSchema.parse({ ...expense, id: '7', amount: '82.50' })).toMatchObject({ id: 7, amount: 82.5 })
    expect(expensePageResponseSchema.parse({
      content: [expense], number: '1', size: '10', totalElements: '11', totalPages: '2',
    })).toMatchObject({ page: 1, totalElements: 11, totalPages: 2 })
  })

  it('preserves an explicit payment link without requiring legacy subscription metadata', () => {
    const parsed = expenseResponseSchema.parse({ ...expense, hasSubscription: undefined, subscriptionPaymentId: '81' })
    expect(parsed).toMatchObject({ subscriptionPaymentId: 81, hasSubscription: false })
    expect(expenseResponseSchema.parse({ ...expense, subscriptionPaymentId: null }).subscriptionPaymentId).toBeNull()
    expect(expenseResponseSchema.safeParse({ ...expense, subscriptionPaymentId: -1 }).success).toBe(false)
  })

  it.each([{ status: 'APPROVED' }, { dueDate: 'Feb 10' }, { amount: 0 }, { type: 'RECURRING' }])(
    'rejects invalid expense API data: %o',
    (invalid) => expect(expenseResponseSchema.safeParse({ ...expense, ...invalid }).success).toBe(false),
  )
})

describe('expense list URL state and date grouping helpers', () => {
  it('omits defaults in URL params, round-trips custom filters, and avoids phantom badge counts', () => {
    const refNow = new Date(2026, 9, 31)
    const defaults = defaultExpenseFilters(refNow)
    expect(countActiveOptionalFilters(defaults, refNow)).toBe(0)
    expect(buildExpenseUrlSearchParams(defaults, refNow).toString()).toBe('')

    const custom = {
      ...defaults,
      year: undefined,
      month: undefined,
      status: 'PENDING' as const,
      categoryIds: [3, 12],
      search: 'internet',
      page: 2,
      sort: 'amount' as const,
      direction: 'asc' as const,
    }
    const serialized = buildExpenseUrlSearchParams(custom, refNow)
    expect(parseExpenseSearchParams(serialized, refNow)).toEqual(custom)
    expect(shiftYearMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftYearMonth(2025, 12, 1)).toEqual({ year: 2026, month: 1 })
  })

  it('groups expenses by date, nulls mixed-currency subtotals, and computes relative urgency cues', () => {
    const groups = groupExpensesByDate(
      [
        { ...expense, id: 1, amount: 40, currency: 'USD', dueDate: '2026-10-31' },
        { ...expense, id: 2, amount: 15.5, currency: 'USD', dueDate: '2026-10-31' },
        { ...expense, id: 3, amount: 25, currency: 'EUR', dueDate: '2026-10-30' },
        { ...expense, id: 4, amount: 10, currency: 'USD', dueDate: '2026-10-30' },
      ],
      { sort: 'dueDate', locale: 'en-US', tenantCurrency: 'USD', todayIso: '2026-10-31' },
    )
    expect(groups).toHaveLength(2)
    expect(groups[0]).toMatchObject({ dateKey: '2026-10-31', subtotal: 55.5 })
    expect(groups[0].label).toContain('Today')
    expect(groups[1].subtotal).toBeNull()

    expect(
      getExpenseDateCue({ ...expense, status: 'PENDING', dueDate: '2026-10-28' }, 'en-US', '2026-10-31'),
    ).toMatchObject({ relativeCue: '3d overdue', tone: 'urgent' })
    expect(
      getExpenseDateCue({ ...expense, status: 'PENDING', dueDate: '2026-11-02' }, 'en-US', '2026-10-31'),
    ).toMatchObject({ relativeCue: 'Due in 2d', tone: 'soon' })
  })
})
