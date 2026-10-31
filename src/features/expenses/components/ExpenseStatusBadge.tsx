import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ExpenseStatus } from '../types'

const STATUS_VARIANTS: Record<ExpenseStatus, 'success' | 'warning' | 'destructive' | 'secondary'> = {
  PAID: 'success',
  PENDING: 'warning',
  OVERDUE: 'destructive',
  CANCELLED: 'secondary',
}

export function ExpenseStatusBadge({
  status,
  compact = false,
}: {
  status: ExpenseStatus
  compact?: boolean
}) {
  return (
    <Badge
      variant={STATUS_VARIANTS[status]}
      className={cn(
        'font-medium',
        compact && 'px-1.5 py-0 text-[10px]',
        status === 'PAID' && 'opacity-85',
      )}
    >
      {status.toLowerCase()}
    </Badge>
  )
}
