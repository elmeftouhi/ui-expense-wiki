import type { Subscription, SubscriptionFrequency } from '../types'

export const FREQUENCY_LABELS: Record<SubscriptionFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 weeks',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMIANNUAL: 'Every 6 months',
  ANNUAL: 'Annual',
  YEARLY: 'Yearly',
  CUSTOM: 'Custom interval',
}

export function formatFrequency(
  frequency: SubscriptionFrequency,
  customIntervalDays?: number | null,
): string {
  if (frequency === 'CUSTOM' && customIntervalDays) {
    return `Every ${customIntervalDays} ${customIntervalDays === 1 ? 'day' : 'days'}`
  }
  return FREQUENCY_LABELS[frequency]
}

export function formatDateOnly(date: string | null | undefined, locale: string): string {
  if (!date) return '—'
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
}

export interface BillingTiming {
  overdue: boolean
  days: number | null
  label: string
  tone: 'overdue' | 'soon' | 'muted'
}

export function getBillingTiming(subscription: Subscription): BillingTiming | null {
  if (subscription.status !== 'ACTIVE') return null
  const { overdue, daysLeftBeforeDueDate: days } = subscription
  if (overdue) {
    return { overdue: true, days, label: 'Overdue', tone: 'overdue' }
  }
  if (days === null) return null
  return {
    overdue: false,
    days,
    label: days === 0 ? 'Due today' : `${days} ${days === 1 ? 'day' : 'days'} left`,
    tone: days <= 7 ? 'soon' : 'muted',
  }
}

