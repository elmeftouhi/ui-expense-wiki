import type { Subscription, SubscriptionRecurringCost } from '../types'

export function annualCost(subscription: Subscription): number {
  const { amount, frequency, customIntervalDays } = subscription
  switch (frequency) {
    case 'DAILY': return amount * 365
    case 'WEEKLY': return amount * 365 / 7
    case 'BIWEEKLY': return amount * 365 / 14
    case 'MONTHLY': return amount * 12
    case 'QUARTERLY': return amount * 4
    case 'SEMIANNUAL': return amount * 2
    case 'ANNUAL':
    case 'YEARLY': return amount
    case 'CUSTOM':
      if (customIntervalDays == null || !Number.isSafeInteger(customIntervalDays) || customIntervalDays <= 0) {
        throw new Error(`Cannot calculate recurring costs for "${subscription.name}": a positive billing interval is required.`)
      }
      return amount * 365 / customIntervalDays
  }
}

export function calculateRecurringCosts(subscriptions: Subscription[]): SubscriptionRecurringCost[] {
  const yearlyByCurrency = new Map<string, number>()
  for (const subscription of subscriptions) {
    yearlyByCurrency.set(subscription.currency, (yearlyByCurrency.get(subscription.currency) ?? 0) + annualCost(subscription))
  }
  return [...yearlyByCurrency].sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, yearly]) => ({ currency, monthly: yearly / 12, yearly }))
}
