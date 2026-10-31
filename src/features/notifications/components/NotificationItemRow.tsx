import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Archive, Check, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Notification } from '../types'
import {
  formatExactTimestamp,
  formatRelativeTime,
  getNotificationRoute,
  getNotificationTypeConfig,
} from '../utils/notificationFormatters'

interface NotificationItemRowProps {
  notification: Notification
  onMarkAsRead: (id: Notification['id']) => void
  onArchive: (id: Notification['id']) => void
  onNavigate?: () => void
  isPending?: boolean
}

export const NotificationItemRow: React.FC<NotificationItemRowProps> = ({
  notification,
  onMarkAsRead,
  onArchive,
  onNavigate,
  isPending = false,
}) => {
  const navigate = useNavigate()
  const { icon: TypeIcon, label, colorClassName, bgClassName } = getNotificationTypeConfig(notification.type)
  const isUnread = notification.status === 'SENT'
  const isArchived = notification.status === 'ARCHIVED'
  const targetRoute = getNotificationRoute(notification)
  const exactTime = formatExactTimestamp(notification.createdAt)
  const relativeTime = formatRelativeTime(notification.createdAt)

  const handleItemClick = (e: React.MouseEvent) => {
    // If user clicked directly on an action button, don't trigger item navigation
    if ((e.target as HTMLElement).closest('button')) return

    if (isUnread) {
      onMarkAsRead(notification.id)
    }

    if (targetRoute) {
      navigate(targetRoute)
      onNavigate?.()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (isUnread) {
        onMarkAsRead(notification.id)
      }
      if (targetRoute) {
        navigate(targetRoute)
        onNavigate?.()
      }
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleItemClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative flex items-start gap-3 p-3.5 transition-colors text-left cursor-pointer border-b border-border/40 hover:bg-muted/40 focus:outline-none focus:bg-muted/50',
        isUnread && 'bg-primary/[0.03] dark:bg-primary/[0.05]',
        isArchived && 'opacity-60 bg-muted/20',
        isPending && 'pointer-events-none opacity-50',
      )}
      aria-label={`${notification.title} - ${relativeTime}`}
    >
      {/* Icon with Type Styling */}
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border mt-0.5 transition-transform group-hover:scale-105',
          bgClassName,
          colorClassName,
        )}
        title={label}
      >
        <TypeIcon className="h-4 w-4" />
      </div>

      {/* Main Text Content */}
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <p
            className={cn(
              'text-xs truncate pr-1',
              isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80',
            )}
          >
            {notification.title}
          </p>

          <span
            className="text-[10px] text-muted-foreground shrink-0 cursor-help"
            title={exactTime}
          >
            {relativeTime}
          </span>
        </div>

        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {notification.message}
        </p>

        {targetRoute && (
          <div className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline pt-0.5">
            <span>View details</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </div>
        )}
      </div>

      {/* Action Buttons (Mark as read, Archive) & Unread Dot */}
      <div className="flex flex-col items-end gap-2 shrink-0 self-start mt-0.5">
        {isUnread && (
          <span
            className="h-2 w-2 rounded-full bg-primary shrink-0"
            title="Unread notification"
            aria-label="Unread"
          />
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
          {isUnread && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onMarkAsRead(notification.id)
              }}
              title="Mark as read"
              aria-label="Mark as read"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}

          {!isArchived && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onArchive(notification.id)
              }}
              title="Archive notification"
              aria-label="Archive notification"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

