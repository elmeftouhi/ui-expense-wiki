import { describe, expect, it } from 'vitest'
import { expenseFormSchema, toExpensePayload, expenseStatusChangeSchema, toExpenseStatusPayload } from '../schemas/expenseSchema'
import { expenseResponseSchema, expensePageResponseSchema } from '../schemas/expenseResponseSchema'
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
