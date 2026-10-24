import { z } from 'zod'
import { SUBSCRIPTION_FREQUENCIES } from '../types'

const numericValue = z.union([
  z.number(),
  z.string().trim().min(1).transform(Number),
]).pipe(z.number().finite())

export const subscriptionResponseSchema = z.object({
  id: numericValue.pipe(z.number().int().positive()),
  name: z.string(),
  description: z.string().nullish(),
  categoryId: numericValue.pipe(z.number().int().positive()),
  categoryName: z.string(),
  ownerUserId: numericValue.pipe(z.number().int().nonnegative()),
  amount: numericValue.refine((amount) => amount > 0),
  currency: z.string().min(1),
  frequency: z.enum(SUBSCRIPTION_FREQUENCIES),
  customIntervalDays: numericValue.pipe(z.number().int().positive()).nullish(),
  nextBillingDate: z.iso.date(),
  overdue: z.boolean(),
  daysLeftBeforeDueDate: numericValue.pipe(z.number().int()).nullable(),
  endDate: z.iso.date().nullish(),
  status: z.enum(['ACTIVE', 'PAUSED', 'STOPPED', 'ENDED']),
  reminderLeadDays: numericValue.pipe(z.number().int().nonnegative()),
  paymentMethod: z.string().nullish(),
  paymentMethodId: numericValue.pipe(z.number().int().positive()).nullish(),
  paymentMethodName: z.string().nullish(),
  notes: z.string().nullish(),
  tenantId: numericValue.pipe(z.number().int().positive()),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: numericValue.pipe(z.number().int().nonnegative()),
}).refine((subscription) => subscription.frequency !== 'CUSTOM' || subscription.customIntervalDays != null, {
  message: 'Custom subscriptions require a billing interval.',
  path: ['customIntervalDays'],
}).transform((subscription) => ({ ...subscription, paymentMethod: subscription.paymentMethodName ?? subscription.paymentMethod }))

export const subscriptionPaymentResponseSchema = z.object({
  id: numericValue.pipe(z.number().int().positive()),
  subscriptionId: numericValue.pipe(z.number().int().positive()),
  scheduledBillingDate: z.iso.date(),
  expenseId: numericValue.pipe(z.number().int().positive()),
  expenseAmount: numericValue,
  expenseCurrency: z.string().min(1),
  expenseStatus: z.enum(['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']),
  expenseDueDate: z.iso.date(),
  expensePaidDate: z.iso.date().nullish(),
  createdAt: z.string(),
})

export const generatePaymentResponseSchema = z.object({
  generated: z.boolean(),
  alreadyExists: z.boolean(),
  message: z.string().nullish(),
  paymentId: numericValue.pipe(z.number().int().positive()),
  expenseId: numericValue.pipe(z.number().int().positive()),
  scheduledBillingDate: z.iso.date(),
}).refine((result) => result.generated !== result.alreadyExists)

const pageFields = {
  content: z.array(subscriptionResponseSchema),
  size: numericValue.pipe(z.number().int().nonnegative()),
  totalElements: numericValue.pipe(z.number().int().nonnegative()),
  totalPages: numericValue.pipe(z.number().int().nonnegative()),
}

const paymentPageFields = {
  content: z.array(subscriptionPaymentResponseSchema),
  size: numericValue.pipe(z.number().int().nonnegative()),
  totalElements: numericValue.pipe(z.number().int().nonnegative()),
  totalPages: numericValue.pipe(z.number().int().nonnegative()),
}

export const subscriptionPageResponseSchema = z.object({
  ...pageFields,
  page: numericValue.pipe(z.number().int().nonnegative()).optional(),
  number: numericValue.pipe(z.number().int().nonnegative()).optional(),
}).transform((page) => ({
  content: page.content,
  page: page.page ?? page.number ?? 0,
  size: page.size,
  totalElements: page.totalElements,
  totalPages: page.totalPages,
}))

export const subscriptionPaymentPageResponseSchema = z.object({
  ...paymentPageFields,
  page: numericValue.pipe(z.number().int().nonnegative()).optional(),
  number: numericValue.pipe(z.number().int().nonnegative()).optional(),
}).transform((page) => ({
  content: page.content,
  page: page.page ?? page.number ?? 0,
  size: page.size,
  totalElements: page.totalElements,
  totalPages: page.totalPages,
}))
