import { z } from 'zod'
import type { BackfillSubscriptionPaymentRequest } from '../types'

export function localToday(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function isValidDateOnly(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
}

export function createBackfillPaymentSchema(getToday: () => string = () => localToday()) {
  return z.object({
    scheduledBillingDate: z.string()
      .min(1, 'Choose the scheduled billing date.')
      .refine(isValidDateOnly, 'Enter a valid scheduled billing date.')
      .refine((value) => !isValidDateOnly(value) || value <= getToday(), 'Scheduled billing date cannot be in the future.'),
    paidDate: z.string().refine((value) => value === '' || isValidDateOnly(value), 'Enter a valid paid date.'),
  })
}

export type BackfillPaymentValues = z.infer<ReturnType<typeof createBackfillPaymentSchema>>

export function toBackfillPayload(values: BackfillPaymentValues): BackfillSubscriptionPaymentRequest {
  return values.paidDate
    ? { scheduledBillingDate: values.scheduledBillingDate, paidDate: values.paidDate }
    : { scheduledBillingDate: values.scheduledBillingDate }
}
