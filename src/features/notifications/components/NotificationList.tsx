import React from 'react'
import {
  AlertCircle,
  Archive,
  Bell,
  CheckCheck,
  Inbox,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  NOTIFICATION_FILTERS,
  type NotificationFilter,
  type NotificationId,
} from '../types'
import { isNotificationPending } from '../store/notificationReducer'
import { useNotifications } from '../context'
import { LiveStreamBadge } from './LiveStreamBadge'
import { NotificationItemRow } from './NotificationItemRow'

interface NotificationListProps {
  onNavigateItem?: () => void
  compact?: boolean
  className?: string
}

const EMPTY_STATE_CONFIG: Record<
  NotificationFilter,
  { icon: React.ComponentType<{ className?: string }>; title: string; message: string }
> = {
  ALL: {
    icon: Inbox,
    title: 'No notifications',
    message: 'When you receive expenses, budget updates or payment alerts, they will appear here.',
  },
  UNREAD: {
    icon: Bell,
    title: 'All caught up!',
    message: 'You have no unread notifications right now.',
  },
  READ: {
    icon: CheckCheck,
    title: 'No read notifications',
    message: 'Notifications you mark as read will be listed here.',
  },
  ARCHIVED: {
    icon: Archive,
    title: 'Archive is empty',
    message: 'Archived notifications are safely stored here for your reference.',
  },
}

export const NotificationList: React.FC<NotificationListProps> = ({
  onNavigateItem,
  compact = false,
  className,
}) => {
  const {
    state,
    items,
    filter,
    unreadCount,
    streamStatus,
    isLoading,
    isLoadingMore,
    isRefreshing,
    hasNext,
    error,
    setFilter,
    markAsRead,
    archive,
    markAllAsRead,
    loadMore,
    refresh,
  } = useNotifications()

  const hasUnread = unreadCount > 0 || items.some((item) => item.status === 'SENT')
  const emptyMeta = EMPTY_STATE_CONFIG[filter]

  return (
    <div className={cn('flex flex-col h-full min-h-0 bg-card text-card-foreground', className)}>
      {/* Filter Tabs & Header Actions Toolbar */}
      <div className={cn('flex flex-col gap-2 border-b border-border/60 bg-muted/20 shrink-0', compact ? 'p-2.5' : 'p-3')}>
        <div className="flex items-center justify-between gap-2">
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <LiveStreamBadge status={streamStatus} />
            {isRefreshing && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Syncing...</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {hasUnread && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void markAllAsRead()}
                disabled={state.bulkPending !== null}
                className="h-7 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                title="Mark all notifications as read"
              >
                <CheckCheck className="h-3.5 w-3.5 text-primary" />
                <span>Mark all read</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refresh()}
              disabled={isRefreshing || isLoading}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
              title="Refresh notifications"
              aria-label="Refresh notifications"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', (isRefreshing || isLoading) && 'animate-spin')} />
            </Button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          role="tablist"
          aria-label="Notification filters"
          className="grid grid-cols-4 gap-1 p-0.5 rounded-lg bg-muted/60 border border-border/60 text-xs"
        >
          {NOTIFICATION_FILTERS.map((tab) => {
            const isActive = filter === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => void setFilter(tab.value)}
                className={cn(
                  'flex items-center justify-center gap-1 py-1 px-1.5 rounded-md font-medium text-[11px] transition-colors cursor-pointer',
                  isActive
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background/40',
                )}
              >
                <span>{tab.label}</span>
                {tab.value === 'UNREAD' && unreadCount > 0 && (
                  <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0 custom-scrollbar">
        {/* Initial Loading Skeleton */}
        {isLoading && items.length === 0 && (
          <div className="p-4 space-y-3" role="status" aria-label="Loading notifications">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="flex items-start gap-3 animate-pulse">
                <div className="h-8 w-8 rounded-lg bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-muted" />
                  <div className="h-2.5 w-4/5 rounded bg-muted/70" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State with Retry */}
        {error && items.length === 0 && (
          <div
            role="alert"
            className="flex flex-col items-center justify-center p-8 text-center space-y-3"
          >
            <div className="p-3 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
              <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Failed to load notifications</p>
              <p className="text-[11px] text-muted-foreground max-w-xs">{error}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refresh()}
              className="text-xs h-8 cursor-pointer gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Try again</span>
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-2.5">
            <div className="p-3 rounded-xl bg-muted/60 border border-border/60 text-muted-foreground">
              <emptyMeta.icon className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">{emptyMeta.title}</p>
              <p className="text-[11px] text-muted-foreground max-w-xs leading-relaxed">
                {emptyMeta.message}
              </p>
            </div>
          </div>
        )}

        {/* Items List */}
        {items.length > 0 && (
          <div className="divide-y divide-border/40">
            {items.map((notification) => (
              <NotificationItemRow
                key={notification.id}
                notification={notification}
                onMarkAsRead={(id: NotificationId) => void markAsRead(id)}
                onArchive={(id: NotificationId) => void archive(id)}
                onNavigate={onNavigateItem}
                isPending={isNotificationPending(state, notification.id)}
              />
            ))}

            {/* Pagination / Load More Footer */}
            {hasNext && (
              <div className="p-3 flex items-center justify-center bg-muted/10 border-t border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void loadMore()}
                  disabled={isLoadingMore}
                  className="w-full text-xs h-8 cursor-pointer gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Loading more...</span>
                    </>
                  ) : (
                    <span>Load more notifications</span>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
