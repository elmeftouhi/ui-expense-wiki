import React from 'react'
import { AlertTriangle, CheckCircle2, CircleDashed, Lock, ShieldAlert, Unlock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { BudgetHealth, BudgetPeriodStatus } from '../types'

const HEALTH_CONFIG: Record<
  BudgetHealth,
  { label: string; variant: 'success' | 'warning' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }
> = {
  ON_TRACK: { label: 'On track', variant: 'success', icon: CheckCircle2 },
  WARNING: { label: 'Near limit', variant: 'warning', icon: AlertTriangle },
  EXCEEDED: { label: 'Exceeded', variant: 'destructive', icon: ShieldAlert },
  NO_PERIOD: { label: 'No activity', variant: 'outline', icon: CircleDashed },
}

export const BudgetHealthBadge: React.FC<{ health: BudgetHealth; className?: string }> = ({
  health,
  className,
}) => {
  const { label, variant, icon: Icon } = HEALTH_CONFIG[health]
  return (
    <Badge variant={variant} className={cn('gap-1 px-1.5 py-0 text-[10px] font-semibold', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  )
}

export const PeriodStatusBadge: React.FC<{ status: BudgetPeriodStatus; className?: string }> = ({
  status,
  className,
}) => {
  const isOpen = status === 'OPEN'
  const Icon = isOpen ? Unlock : Lock
  return (
    <Badge
      variant={isOpen ? 'info' : 'secondary'}
      className={cn('gap-1 px-1.5 py-0 text-[10px] font-medium tracking-wide', className)}
    >
      <Icon className="h-2.5 w-2.5" />
      {status}
    </Badge>
  )
}
