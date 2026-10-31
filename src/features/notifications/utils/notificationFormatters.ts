import type { ComponentType } from 'react'
import {
  AlertOctagon,
  AlertTriangle,
  Bell,
  CalendarSync,
  Clock,
  CreditCard,
  PiggyBank,
} from 'lucide-react'
import type { Notification, NotificationType } from '../types'

export interface NotificationTypeVisualConfig {
  icon: ComponentType<{ className?: string }>
  label: string
  colorClassName: string
  bgClassName: string
  badgeClassName: string
}

export const NOTIFICATION_TYPE_CONFIGS: Record<string, NotificationTypeVisualConfig> = {
  PAYMENT_REMINDER: {
    icon: CreditCard,
    label: 'Payment Reminder',
    colorClassName: 'text-amber-600 dark:text-amber-400',
    bgClassName: 'bg-amber-500/10 border-amber-500/25',
    badgeClassName: 'border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10',
  },
  SUBSCRIPTION_NEXT: {
    icon: CalendarSync,
    label: 'Subscription Renewal',
    colorClassName: 'text-purple-600 dark:text-purple-400',
    bgClassName: 'bg-purple-500/10 border-purple-500/25',
    badgeClassName: 'border-purple-500/30 text-purple-700 dark:text-purple-300 bg-purple-500/10',
  },
  EXPENSE_DUE_SOON: {
    icon: Clock,
    label: 'Due Soon',
    colorClassName: 'text-amber-600 dark:text-amber-400',
    bgClassName: 'bg-amber-500/10 border-amber-500/25',
    badgeClassName: 'border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10',
  },
  EXPENSE_OVERDUE: {
    icon: AlertOctagon,
    label: 'Expense Overdue',
    colorClassName: 'text-destructive',
    bgClassName: 'bg-destructive/10 border-destructive/25',
    badgeClassName: 'border-destructive/30 text-destructive bg-destructive/10',
  },
  BUDGET_ALERT: {
    icon: AlertTriangle,
    label: 'Budget Alert',
    colorClassName: 'text-amber-600 dark:text-amber-400',
    bgClassName: 'bg-amber-500/10 border-amber-500/25',
    badgeClassName: 'border-amber-500/30 text-amber-700 dark:text-amber-300 bg-amber-500/10',
  },
  BUDGET_EXCEEDED: {
    icon: PiggyBank,
    label: 'Budget Exceeded',
    colorClassName: 'text-destructive',
    bgClassName: 'bg-destructive/10 border-destructive/25',
    badgeClassName: 'border-destructive/30 text-destructive bg-destructive/10',
  },
}

const DEFAULT_TYPE_CONFIG: NotificationTypeVisualConfig = {
  icon: Bell,
  label: 'Notification',
  colorClassName: 'text-primary',
  bgClassName: 'bg-primary/10 border-primary/25',
  badgeClassName: 'border-primary/30 text-primary bg-primary/10',
}

export function getNotificationTypeConfig(type: NotificationType): NotificationTypeVisualConfig {
  return NOTIFICATION_TYPE_CONFIGS[type] ?? DEFAULT_TYPE_CONFIG
}

/**
 * Formats a timestamp into human-readable relative time (e.g. "Just now", "2m ago", "3h ago", "4d ago").
 */
export function formatRelativeTime(
  timestamp: string | Date | number | null | undefined,
  baseNow: Date = new Date(),
): string {
  if (!timestamp) return '—'
  const time = typeof timestamp === 'number'
    ? timestamp
    : timestamp instanceof Date
      ? timestamp.getTime()
      : Date.parse(timestamp)

  if (Number.isNaN(time)) return '—'

  const elapsedSeconds = Math.max(0, Math.floor((baseNow.getTime() - time) / 1000))

  if (elapsedSeconds < 45) return 'Just now'
  const minutes = Math.floor(elapsedSeconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  const years = Math.floor(days / 365)
  return `${years}y ago`
}

/**
 * Formats an exact timestamp string for accessible tooltip inspection.
 */
export function formatExactTimestamp(timestamp: string | Date | number | null | undefined): string {
  if (!timestamp) return ''
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
  })
}

/**
 * Resolves a route for a notification based on subjectType and subjectId.
 */
export function getNotificationRoute(notification: Pick<Notification, 'subjectType' | 'subjectId'>): string | null {
  const { subjectType, subjectId } = notification
  if (!subjectType) return null

  const normalized = subjectType.trim().toUpperCase()
  if (normalized === 'EXPENSE' || normalized === 'EXPENSES') {
    return subjectId ? `/expenses/${subjectId}` : '/expenses'
  }
  if (normalized === 'SUBSCRIPTION' || normalized === 'SUBSCRIPTIONS') {
    return subjectId ? `/subscriptions/${subjectId}` : '/subscriptions'
  }
  if (normalized === 'BUDGET' || normalized === 'BUDGETS') {
    return subjectId ? `/budgets/${subjectId}` : '/budgets'
  }
  if (normalized === 'RECEIPT' || normalized === 'RECEIPTS') {
    return '/receipts'
  }
  if (normalized === 'TENANT' || normalized === 'WORKSPACE') {
    return '/tenants'
  }
  return null
}
