import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SubscriptionStatus } from '../types'

const VARIANT = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  STOPPED: 'secondary',
  ENDED: 'outline',
} as const

export function SubscriptionStatusBadge({
  status,
  className,
}: {
  status: SubscriptionStatus
  className?: string
}) {
  return (
    <Badge variant={VARIANT[status]} className={cn('px-1.5 py-0 text-[10px] font-semibold', className)}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  )
}
