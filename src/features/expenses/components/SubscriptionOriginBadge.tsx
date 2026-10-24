import { Badge } from '@/components/ui/badge'
import type { ExpenseResponse } from '../types'
import { isSubscriptionExpense } from '../utils/subscriptionOrigin'

export function SubscriptionOriginBadge({ expense }: { expense: ExpenseResponse }) {
  return isSubscriptionExpense(expense) ? <Badge variant="outline">Subscription</Badge> : null
}
