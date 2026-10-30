import { z } from 'zod'
import type { ExpenseCategoryStatistic } from '../types'

const numericValue = z.union([
  z.number(),
  z.string().trim().min(1).transform(Number),
]).pipe(z.number().finite())

export const expenseResponseSchema = z.object({
  id: numericValue.pipe(z.number().int().positive()),
  categoryId: numericValue.pipe(z.number().int().positive()),
  categoryName: z.string(),
  userId: numericValue.pipe(z.number().int().nonnegative()),
  description: z.string(),
  amount: numericValue.refine((amount) => amount > 0),
  currency: z.string().min(1),
  type: z.enum(['NORMAL', 'SUBSCRIPTION']),
  status: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']),
  dueDate: z.iso.date(),
  paidDate: z.iso.date().nullish(),
  paymentMethod: z.string().nullish(),
  paymentMethodId: numericValue.pipe(z.number().int().positive()).nullish(),
  paymentMethodName: z.string().nullish(),
  notes: z.string().nullish(),
  hasSubscription: z.boolean().default(false),
  subscriptionPaymentId: numericValue.pipe(z.number().int().positive()).nullish(),
  tenantId: numericValue.pipe(z.number().int().positive()),
  createdAt: z.string(),
  updatedAt: z.string(),
}).transform((expense) => ({ ...expense, paymentMethod: expense.paymentMethodName ?? expense.paymentMethod }))

const pageNumber = z.union([
  z.number(),
  z.string().trim().min(1).transform(Number),
]).pipe(z.number().int().nonnegative())

export const expensePageResponseSchema = z.object({
  content: z.array(expenseResponseSchema),
  page: pageNumber.optional(),
  number: pageNumber.optional(),
  size: pageNumber,
  totalElements: pageNumber,
  totalPages: pageNumber,
  filteredTotalAmount: numericValue.optional(),
  recordsCount: pageNumber.optional(),
}).transform((page) => ({
  content: page.content,
  page: page.page ?? page.number ?? 0,
  size: page.size,
  totalElements: page.totalElements,
  totalPages: page.totalPages,
  filteredTotalAmount: page.filteredTotalAmount,
  recordsCount: page.recordsCount,
}))

const expenseCategoryStatisticSchema: z.ZodType<ExpenseCategoryStatistic> = z.object({
  categoryId: numericValue.pipe(z.number().int().positive()),
  categoryName: z.string(),
  total: numericValue,
  parentTotal: numericValue.nullable(),
  subCategories: z.array(z.lazy(() => expenseCategoryStatisticSchema)),
})

export const expenseStatisticsResponseSchema = z.object({
  totalExpenses: numericValue,
  totalPaid: numericValue,
  totalPending: numericValue,
  totalOverdue: numericValue,
  overdueCount: pageNumber,
  pendingCount: pageNumber,
  byCategory: z.array(expenseCategoryStatisticSchema),
})
