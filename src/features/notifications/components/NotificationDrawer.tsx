import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { Bell, ExternalLink, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNotifications } from '../context'
import { NotificationList } from './NotificationList'

interface NotificationDrawerProps {
  isOpen: boolean
  onClose: () => void
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ isOpen, onClose }) => {
  const { registerViewer, unreadCount } = useNotifications()
  const drawerRef = useRef<HTMLDivElement>(null)

  // Register as an active viewer while open to drive page polling fallback
  useEffect(() => {
    if (!isOpen) return
    const unregister = registerViewer()
    return unregister
  }, [isOpen, registerViewer])

  // Handle escape key and scroll lock
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = originalOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-xs transition-opacity animate-in fade-in-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer Panel */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Notification Center"
        className={cn(
          'relative z-50 flex h-full w-full max-w-md flex-col border-l border-border bg-card text-card-foreground shadow-2xl animate-in slide-in-from-right duration-200',
        )}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3.5 bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {unreadCount} unread
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              to="/notifications"
              onClick={onClose}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted transition-colors"
              title="Open full Notifications page"
            >
              <span>Full page</span>
              <ExternalLink className="h-3 w-3" />
            </Link>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close notification center"
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          <NotificationList onNavigateItem={onClose} />
        </div>
      </div>
    </div>,
    document.body,
  )
}
