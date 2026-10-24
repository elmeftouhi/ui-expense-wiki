import { z } from 'zod'
import type { SubscriptionFrequency, SubscriptionWriteRequest } from '../types'
import { SUBSCRIPTION_FREQUENCIES } from '../types'

const dateOnlySchema = z.iso.date({ error: 'Enter a valid date.' })

export const subscriptionFormSchema = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(120, 'Name must be 120 characters or fewer.'),
  description: z.string().trim().max(1000, 'Description must be 1000 characters or fewer.'),
  categoryId: z.number({ error: 'Select a category.' }).int().positive('Select a category.'),
  amount: z.number({ error: 'Enter a valid amount.' }).finite().positive('Amount must be greater than 0.'),
  frequency: z.enum(SUBSCRIPTION_FREQUENCIES, { error: 'Select a billing frequency.' }),
  customIntervalDays: z.union([
    z.number().int().positive('Custom interval must be a whole number of days.'),
    z.nan().transform(() => undefined),
  ]).optional(),
  nextBillingDate: dateOnlySchema,
  endDate: z.union([z.literal(''), dateOnlySchema]),
  reminderLeadDays: z.number().int().min(0, 'Reminder days cannot be negative.'),
  paymentMethodId: z.number().int().positive('Choose a payment method.').optional(),
  notes: z.string().trim().max(1000, 'Notes must be 1000 characters or fewer.'),
}).superRefine((values, context) => {
  if (values.frequency === 'CUSTOM' && values.customIntervalDays === undefined) {
    context.addIssue({
      code: 'custom',
      path: ['customIntervalDays'],
      message: 'Enter the number of days between billings.',
    })
  }
  if (values.endDate && values.endDate < values.nextBillingDate) {
    context.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'End date must be on or after the next billing date.',
    })
  }
})

export type SubscriptionFormValues = z.infer<typeof subscriptionFormSchema>

export function toSubscriptionPayload(values: SubscriptionFormValues): SubscriptionWriteRequest {
  const clean = (value: string) => value.trim() || undefined
  return {
    name: values.name.trim(),
    ...(clean(values.description) ? { description: clean(values.description) } : {}),
    categoryId: values.categoryId,
    amount: values.amount,
    frequency: values.frequency as SubscriptionFrequency,
    ...(values.frequency === 'CUSTOM' ? { customIntervalDays: values.customIntervalDays } : {}),
    nextBillingDate: toDateOnly(values.nextBillingDate),
    ...(values.endDate ? { endDate: toDateOnly(values.endDate) } : {}),
    reminderLeadDays: values.reminderLeadDays,
    paymentMethodId: values.paymentMethodId ?? null,
    ...(clean(values.notes) ? { notes: clean(values.notes) } : {}),
  }
}

/** Date inputs and API date-only fields stay calendar dates, never UTC timestamps. */
export function toDateOnly(value: string): string {
  const parsed = dateOnlySchema.parse(value)
  return parsed
}

export const DEFAULT_SUBSCRIPTION_FORM_VALUES: SubscriptionFormValues = {
  name: '',
  description: '',
  categoryId: 0,
  amount: Number.NaN,
  frequency: 'MONTHLY',
  customIntervalDays: undefined,
  nextBillingDate: '',
  endDate: '',
  reminderLeadDays: 3,
  paymentMethodId: undefined,
  notes: '',
}
