import { Badge } from '@/components/ui/badge'
import type { ExpenseStatus } from '../types'

const STATUS_VARIANTS: Record<ExpenseStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  PAID: 'success',
  PENDING: 'warning',
  OVERDUE: 'destructive',
  CANCELLED: 'secondary',
}

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return <Badge variant={STATUS_VARIANTS[status]} className="font-medium">{status.toLowerCase()}</Badge>
}
