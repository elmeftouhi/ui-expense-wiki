import { Badge } from '@/components/ui/badge'
import type { SubscriptionStatus } from '../types'

const VARIANT = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  STOPPED: 'secondary',
  ENDED: 'outline',
} as const

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return <Badge variant={VARIANT[status]}>{status.charAt(0) + status.slice(1).toLowerCase()}</Badge>
}
