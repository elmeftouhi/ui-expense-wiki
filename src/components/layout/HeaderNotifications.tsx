import React, { useState, useRef, useEffect } from 'react'
import {
  Bell,
  CheckCircle2,
  Receipt,
  AlertTriangle,
  UserPlus,
  CheckCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface NotificationItem {
  id: string | number
  title: string
  message: string
  timeAgo: string
  read: boolean
  type: 'approval' | 'receipt' | 'budget' | 'member'
}

const INITIAL_NOTIFICATIONS: NotificationItem[] = [
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
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS)
  const containerRef = useRef<HTMLDivElement>(null)

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

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const markAsRead = (id: string | number) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }

  const getNotificationIcon = (type: NotificationItem['type']) => {
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
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={isOpen}
      >
        <Bell className="h-4 w-4" />

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-xs">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          role="region"
          aria-label="Notifications"
          className="fixed inset-x-3 top-15 z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-50 zoom-in-95 overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-96 sm:max-w-[calc(100vw-2rem)]"
        >
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
                onClick={markAllAsRead}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark all read</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-border/50">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                You&apos;re all caught up.
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => markAsRead(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      markAsRead(item.id)
                    }
                  }}
                  className={cn(
                    'flex items-start gap-3 px-3.5 py-2.5 transition-colors text-left cursor-pointer hover:bg-accent/50',
                    !item.read && 'bg-primary/[0.04]',
                  )}
                >
                  <div className="p-1.5 rounded-lg bg-muted/60 border border-border/60 shrink-0 mt-0.5">
                    {getNotificationIcon(item.type)}
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
  )
}
