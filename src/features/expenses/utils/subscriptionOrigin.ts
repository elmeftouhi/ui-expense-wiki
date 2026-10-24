import type { ExpenseResponse } from '../types'

export function isSubscriptionExpense(expense: ExpenseResponse) {
  return expense.subscriptionPaymentId != null || expense.type === 'SUBSCRIPTION' || expense.hasSubscription
}
