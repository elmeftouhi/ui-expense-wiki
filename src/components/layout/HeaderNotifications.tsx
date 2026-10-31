import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  CheckCircle2,
  Receipt,
  AlertTriangle,
  UserPlus,
  CheckCheck,
  ExternalLink,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotificationsSafe } from '@/features/notifications'
import { LiveStreamBadge } from '@/features/notifications/components/LiveStreamBadge'
import { NotificationList } from '@/features/notifications/components/NotificationList'

export interface FallbackNotificationItem {
  id: string | number
  title: string
  message: string
  timeAgo: string
  read: boolean
  type: 'approval' | 'receipt' | 'budget' | 'member'
}

const INITIAL_FALLBACK_NOTIFICATIONS: FallbackNotificationItem[] = [
  {
    id: 1,
    title: 'Expense Approved',
    message: 'EXP-1001 ($850.00) was approved by Finance Department.',
    timeAgo: '12m ago',
    read: false,
    type: 'approval',
  },
  {
    id: 2,
    title: 'Receipt OCR Processed',
    message: 'hotel_invoice_mar24.pdf extracted with 98% confidence score.',
    timeAgo: '45m ago',
    read: false,
    type: 'receipt',
  },
  {
    id: 3,
    title: 'Budget Alert (85%)',
    message: 'Software & Cloud category reached 85% of monthly budget limit.',
    timeAgo: '2h ago',
    read: false,
    type: 'budget',
  },
  {
    id: 4,
    title: 'New Member Joined',
    message: 'Sarah Miller accepted invitation as Workspace Editor.',
    timeAgo: '1d ago',
    read: true,
    type: 'member',
  },
]

export const HeaderNotifications: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Real context (when wrapped in NotificationProvider)
  const notificationContext = useNotificationsSafe()

  // Fallback state for isolated test environments
  const [fallbackNotifications, setFallbackNotifications] = useState<FallbackNotificationItem[]>(
    INITIAL_FALLBACK_NOTIFICATIONS,
  )

  // Register viewer when open if real context is available
  const registerViewer = notificationContext?.registerViewer
  useEffect(() => {
    if (!isOpen || !registerViewer) return
    const unregister = registerViewer()
    return unregister
  }, [isOpen, registerViewer])

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const unreadCount = notificationContext
    ? notificationContext.unreadCount
    : fallbackNotifications.filter((n) => !n.read).length

  const isStreamLive = notificationContext?.streamStatus === 'online'

  const handleMarkAllAsRead = () => {
    if (notificationContext) {
      void notificationContext.markAllAsRead()
    } else {
      setFallbackNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    }
  }

  const handleMarkFallbackAsRead = (id: string | number) => {
    setFallbackNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }

  const getFallbackIcon = (type: FallbackNotificationItem['type']) => {
    switch (type) {
      case 'approval':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
      case 'receipt':
        return <Receipt className="w-3.5 h-3.5 text-blue-500" />
      case 'budget':
        return <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
      case 'member':
      default:
        return <UserPlus className="w-3.5 h-3.5 text-purple-500" />
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id="header-notifications-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background hover:bg-accent/60 transition-colors text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring',
          isOpen && 'bg-accent/70 text-foreground ring-2 ring-ring/30',
        )}
        title={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />

        {/* Live SSE indicator dot when online */}
        {isStreamLive && (
          <span className="absolute bottom-1 right-1 flex h-1.5 w-1.5" title="Live notification stream">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
        )}

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-xs">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="region"
          aria-label="Notifications"
          className="fixed inset-x-3 top-15 z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-50 zoom-in-95 overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-96 sm:max-w-[calc(100vw-2rem)] flex flex-col max-h-[85vh] sm:max-h-[560px]"
        >
          {notificationContext ? (
            /* Real Live Notification Center */
            <div className="flex flex-col h-full overflow-hidden">
              <div className="px-3.5 py-2.5 border-b border-border/60 flex items-center justify-between bg-muted/20 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-foreground">Notifications</span>
                  <LiveStreamBadge status={notificationContext.streamStatus} />
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    to="/notifications"
                    onClick={() => setIsOpen(false)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Open notifications page"
                  >
                    <span>Full page</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              <div className="flex-1 overflow-hidden min-h-0">
                <NotificationList onNavigateItem={() => setIsOpen(false)} compact />
              </div>
            </div>
          ) : (
            /* Fallback mock notifications for isolated testing */
            <div>
              <div className="px-3.5 py-2.5 border-b border-border/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xs text-foreground">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5">
                      {unreadCount} unread
                    </span>
                  )}
                </div>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all read</span>
                  </button>
                )}
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
                {fallbackNotifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">
                    You&apos;re all caught up.
                  </div>
                ) : (
                  fallbackNotifications.map((item) => (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleMarkFallbackAsRead(item.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleMarkFallbackAsRead(item.id)
                        }
                      }}
                      className={cn(
                        'flex items-start gap-3 px-3.5 py-2.5 transition-colors text-left cursor-pointer hover:bg-accent/50',
                        !item.read && 'bg-primary/[0.04]',
                      )}
                    >
                      <div className="p-1.5 rounded-lg bg-muted/60 border border-border/60 shrink-0 mt-0.5">
                        {getFallbackIcon(item.type)}
                      </div>

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={cn(
                              'text-xs truncate',
                              !item.read ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground',
                            )}
                          >
                            {item.title}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {item.timeAgo}
                          </span>
                        </div>

                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {item.message}
                        </p>
                      </div>

                      {!item.read && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1.5"
                          title="Unread"
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
