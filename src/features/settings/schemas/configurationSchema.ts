import { z } from 'zod'

export const CURRENCIES = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'SAR', 'AED'] as const
export const LANGUAGES = ['EN', 'FR', 'ES', 'DE', 'AR', 'ZH', 'JA', 'PT', 'RU', 'IT'] as const

const nonEmpty = z.string().trim().min(1, 'This field is required.')
const day = z.number().int().min(0).max(2147483647)
const channels = z.array(nonEmpty)
const reminderDays = z.array(day)

function jsonArray<T>(schema: z.ZodType<T>) {
  return z.string().refine((value) => {
    try {
      return schema.safeParse(JSON.parse(value)).success
    } catch {
      return false
    }
  }, 'The server returned an invalid settings list.')
}

export const configurationRequestSchema = z.object({
  currency: z.enum(CURRENCIES),
  decimalPlaces: z.number().int().min(0).max(2147483647),
  language: z.enum(LANGUAGES),
  timezone: nonEmpty,
  dateFormat: nonEmpty,
  timeFormat: z.enum(['FORMAT_12H', 'FORMAT_24H']),
  weekStartDay: z.enum(['MONDAY', 'SUNDAY']),
  budgetAlertThreshold: z.number().int().min(0).max(100),
  notificationChannels: jsonArray(channels),
  autoPaymentReminderDays: jsonArray(reminderDays),
  expenseRoundingMethod: nonEmpty,
  reportingPeriod: nonEmpty,
})

export const configurationResponseSchema = configurationRequestSchema.extend({
  id: z.number().int().positive(),
  tenantId: z.number().int().positive(),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  createdBy: z.string().nullable(),
  updatedBy: z.string().nullable(),
})

function splitList(value: string) {
  return value.trim() === '' ? [] : value.split(',').map((item) => item.trim())
}

export const configurationFormSchema = configurationRequestSchema.extend({
  notificationChannels: z.string().refine(
    (value) => splitList(value).every((item) => item.length > 0),
    'Enter channel codes separated by commas, such as IN_APP.',
  ),
  autoPaymentReminderDays: z.string().refine(
    (value) => splitList(value).every((item) => /^\d+$/.test(item) && day.safeParse(Number(item)).success),
    'Enter whole, non-negative days separated by commas, such as 3, 7.',
  ),
})

export type ConfigurationFormValues = z.infer<typeof configurationFormSchema>

export function toFormValues(config: z.infer<typeof configurationRequestSchema>): ConfigurationFormValues {
  return {
    ...configurationRequestSchema.parse(config),
    notificationChannels: channels.parse(JSON.parse(config.notificationChannels)).join(', '),
    autoPaymentReminderDays: reminderDays.parse(JSON.parse(config.autoPaymentReminderDays)).join(', '),
  }
}

export function toConfigurationRequest(values: ConfigurationFormValues) {
  const validated = configurationFormSchema.parse(values)
  return configurationRequestSchema.parse({
    ...validated,
    notificationChannels: JSON.stringify(splitList(validated.notificationChannels)),
    autoPaymentReminderDays: JSON.stringify(splitList(validated.autoPaymentReminderDays).map(Number)),
  })
}
