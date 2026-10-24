import { describe, expect, it } from 'vitest'
import { subscriptionFormSchema, toDateOnly, toSubscriptionPayload } from '../schemas/subscriptionSchema'
import { subscriptionResponseSchema, subscriptionPaymentResponseSchema } from '../schemas/subscriptionResponseSchema'
import { subscription, payment } from './fixtures'
import { calculateRecurringCosts } from '../utils/recurringCosts'
import type { SubscriptionFrequency } from '../types'

const formValues = {
  name: '  Design tools ',
  description: '  Team plan  ',
  categoryId: 5,
  amount: 45,
  frequency: 'MONTHLY' as const,
  customIntervalDays: undefined,
  nextBillingDate: '2026-11-05',
  endDate: '',
  reminderLeadDays: 3,
  paymentMethodId: 2,
  notes: '',
}

describe('subscription form schema', () => {
  it('requires a name, category, positive amount, frequency, and billing date', () => {
    expect(subscriptionFormSchema.parse(formValues)).toMatchObject({ name: 'Design tools', amount: 45, categoryId: 5 })
    for (const invalid of [
      { name: ' ' }, { categoryId: 0 }, { amount: 0 }, { amount: -1 },
      { frequency: 'BIANNUAL' }, { nextBillingDate: '11/05/2026' },
    ]) {
      expect(subscriptionFormSchema.safeParse({ ...formValues, ...invalid }).success).toBe(false)
    }
  })

  it('requires a positive custom interval and strips it for non-custom schedules', () => {
    expect(subscriptionFormSchema.safeParse({ ...formValues, frequency: 'CUSTOM', customIntervalDays: undefined }).success).toBe(false)
    expect(subscriptionFormSchema.safeParse({ ...formValues, frequency: 'CUSTOM', customIntervalDays: 0 }).success).toBe(false)
    const custom = subscriptionFormSchema.parse({ ...formValues, frequency: 'CUSTOM', customIntervalDays: 11 })
    expect(toSubscriptionPayload(custom)).toMatchObject({ frequency: 'CUSTOM', customIntervalDays: 11 })
    expect(toSubscriptionPayload(subscriptionFormSchema.parse({ ...formValues, frequency: 'ANNUAL', customIntervalDays: 11 }))).not.toHaveProperty('customIntervalDays')
  })

  it('checks reminder days and ensures the end date is not before the next billing date', () => {
    expect(subscriptionFormSchema.safeParse({ ...formValues, reminderLeadDays: -1 }).success).toBe(false)
    expect(subscriptionFormSchema.safeParse({ ...formValues, reminderLeadDays: 0 }).success).toBe(true)
    expect(subscriptionFormSchema.safeParse({ ...formValues, endDate: '2026-11-04' }).success).toBe(false)
    expect(subscriptionFormSchema.safeParse({ ...formValues, endDate: '2026-11-05' }).success).toBe(true)
  })

  it('trims optional fields, omits blanks, and serializes date-only values unchanged', () => {
    expect(toDateOnly('2026-11-05')).toBe('2026-11-05')
    expect(toSubscriptionPayload(subscriptionFormSchema.parse({ ...formValues, description: ' ', paymentMethodId: undefined, notes: '  ' }))).toEqual({
      name: 'Design tools', categoryId: 5, amount: 45, frequency: 'MONTHLY', nextBillingDate: '2026-11-05',
      reminderLeadDays: 3,
      paymentMethodId: null,
    })
  })
})

describe('subscription response contracts', () => {
  it('preserves payment method IDs and displays the current API method name', () => {
    expect(subscriptionResponseSchema.parse({ ...subscription, paymentMethodId: '2', paymentMethodName: 'Company card' }))
      .toMatchObject({ paymentMethodId: 2, paymentMethod: 'Company card' })
  })

  it('normalizes numeric strings and accepts nullable optional dates', () => {
    expect(subscriptionResponseSchema.parse({
      ...subscription, id: '12', amount: '45.50', reminderLeadDays: '3', version: '2', daysLeftBeforeDueDate: '-4', overdue: true,
    })).toMatchObject({ id: 12, amount: 45.5, reminderLeadDays: 3, version: 2, daysLeftBeforeDueDate: -4, overdue: true })
    expect(subscriptionResponseSchema.parse({ ...subscription, daysLeftBeforeDueDate: null }).daysLeftBeforeDueDate).toBeNull()
    expect(subscriptionPaymentResponseSchema.parse({
      ...payment, expenseAmount: '45.50', expenseId: '902',
    })).toMatchObject({ expenseAmount: 45.5, expenseId: 902 })
  })

  it.each([
    { amount: 0 }, { status: 'DELETED' }, { nextBillingDate: 'Nov 5' }, { categoryId: -2 },
    { overdue: 'true' }, { overdue: undefined }, { daysLeftBeforeDueDate: 1.5 },
    { daysLeftBeforeDueDate: undefined }, { frequency: 'CUSTOM', customIntervalDays: null },
  ])('rejects invalid server data: %o', (invalid) => {
    expect(subscriptionResponseSchema.safeParse({ ...subscription, ...invalid }).success).toBe(false)
  })

  describe('normalized recurring costs', () => {
    it.each<{ frequency: SubscriptionFrequency; amount: number; yearly: number; customIntervalDays?: number }>([
      { frequency: 'MONTHLY', amount: 10, yearly: 120 },
      { frequency: 'QUARTERLY', amount: 30, yearly: 120 },
      { frequency: 'SEMIANNUAL', amount: 60, yearly: 120 },
      { frequency: 'ANNUAL', amount: 120, yearly: 120 },
      { frequency: 'YEARLY', amount: 120, yearly: 120 },
      { frequency: 'DAILY', amount: 1, yearly: 365 },
      { frequency: 'WEEKLY', amount: 7, yearly: 365 },
      { frequency: 'BIWEEKLY', amount: 14, yearly: 365 },
      { frequency: 'CUSTOM', amount: 90, customIntervalDays: 90, yearly: 365 },
      { frequency: 'CUSTOM', amount: 180, customIntervalDays: 180, yearly: 365 },
    ])('annualizes $frequency ($customIntervalDays days)', ({ frequency, amount, customIntervalDays, yearly }) => {
      const [cost] = calculateRecurringCosts([{ ...subscription, frequency, amount, customIntervalDays }])
      expect(cost.yearly).toBeCloseTo(yearly, 8)
      expect(cost.monthly).toBeCloseTo(yearly / 12, 8)
    })

    it('sums all matching statuses without rounding intermediate values or combining currencies', () => {
      const costs = calculateRecurringCosts([
        { ...subscription, frequency: 'ANNUAL', amount: 120 },
        { ...subscription, frequency: 'SEMIANNUAL', amount: 60 },
        { ...subscription, frequency: 'CUSTOM', customIntervalDays: 90, amount: 90 },
        { ...subscription, currency: 'EUR', amount: 10 },
        ...(['PAUSED', 'STOPPED', 'ENDED'] as const).map((status) => ({ ...subscription, status, amount: 9999 })),
      ])
      expect(costs).toHaveLength(2)
      expect(costs[0]).toEqual({ currency: 'EUR', monthly: 10, yearly: 120 })
      expect(costs[1].yearly).toBe(605 + 9999 * 12 * 3)
      expect(costs[1].monthly).toBeCloseTo(605 / 12 + 9999 * 3, 8)
      expect(calculateRecurringCosts([])).toEqual([])
    })

    it.each([null, undefined, 0, -5, 1.5])('rejects an invalid custom interval %s instead of undercounting', (customIntervalDays) => {
      expect(() => calculateRecurringCosts([{ ...subscription, frequency: 'CUSTOM', customIntervalDays }]))
        .toThrow('a positive billing interval is required')
    })
  })
})
