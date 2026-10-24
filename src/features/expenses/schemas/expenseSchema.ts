import { z } from 'zod'
import type { ExpenseResponse, ExpenseStatus, ExpenseUpsertRequest } from '../types'

const dateOnlySchema = z.iso.date({ error: 'Enter a valid date.' })

export const expenseFormSchema = z.object({
  categoryId: z.number({ error: 'Choose a category.' }).int().positive('Choose a category.'),
  description: z.string().trim().max(500, 'Description must be 500 characters or fewer.'),
  amount: z.number({ error: 'Enter a valid amount.' }).finite().positive('Amount must be greater than 0.'),
  dueDate: dateOnlySchema,
  paidDate: z.union([z.literal(''), dateOnlySchema]),
  type: z.enum(['NORMAL', 'SUBSCRIPTION']),
  paymentMethodId: z.number().int().positive('Choose a payment method.').optional(),
  notes: z.string().trim().max(1000, 'Notes must be 1000 characters or fewer.'),
})

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>

const clean = (value: string) => value.trim() || undefined

export function toExpensePayload(values: ExpenseFormValues, categoryName: string): ExpenseUpsertRequest {
  const description = values.description.trim() || categoryName.trim()
  if (!description) throw new Error('Choose a category to name this expense.')
  return {
    categoryId: values.categoryId,
    description,
    amount: values.amount,
    dueDate: toDateOnly(values.dueDate),
    paidDate: values.paidDate ? toDateOnly(values.paidDate) : null,
    type: values.type,
    paymentMethodId: values.paymentMethodId ?? null,
    notes: clean(values.notes) ?? null,
  }
}

export function toDateOnly(value: string): string {
  return dateOnlySchema.parse(value)
}

export function expenseToFormValues(expense: ExpenseResponse): ExpenseFormValues {
  return {
    categoryId: expense.categoryId,
    description: expense.description,
    amount: expense.amount,
    dueDate: expense.dueDate,
    paidDate: expense.paidDate ?? '',
    type: expense.type,
    paymentMethodId: expense.paymentMethodId ?? undefined,
    notes: expense.notes ?? '',
  }
}

export const expenseStatusChangeSchema = z.object({
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']),
  paidDate: z.union([z.literal(''), dateOnlySchema]),
}).superRefine((values, context) => {
  if (values.status === 'PAID' && !values.paidDate) {
    context.addIssue({
      code: 'custom',
      path: ['paidDate'],
      message: 'Paid date is required when status is Paid.',
    })
  }
})

export type ExpenseStatusFormValues = z.infer<typeof expenseStatusChangeSchema>

export function toExpenseStatusPayload(values: ExpenseStatusFormValues, currentStatus?: ExpenseStatus) {
  if (values.status === 'PAID') return { status: values.status, paidDate: toDateOnly(values.paidDate) }
  if (currentStatus === 'PAID') return { status: values.status, paidDate: null }
  return { status: values.status }
}

export const markAsPaidSchema = z.object({
  paidDate: dateOnlySchema,
})
