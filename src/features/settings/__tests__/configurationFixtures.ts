import type { TenantConfiguration } from '../types'

export const configuration: TenantConfiguration = {
  id: 1,
  tenantId: 1,
  currency: 'USD',
  decimalPlaces: 2,
  language: 'EN',
  timezone: 'UTC',
  dateFormat: 'yyyy-MM-dd',
  timeFormat: 'FORMAT_24H',
  weekStartDay: 'MONDAY',
  budgetAlertThreshold: 80,
  notificationChannels: '["IN_APP"]',
  autoPaymentReminderDays: '[3,7]',
  expenseRoundingMethod: 'NONE',
  reportingPeriod: 'CALENDAR_MONTH',
  createdAt: '2026-10-17T15:13:47.459146Z',
  updatedAt: '2026-10-17T15:13:47.459146Z',
  createdBy: null,
  updatedBy: null,
}
