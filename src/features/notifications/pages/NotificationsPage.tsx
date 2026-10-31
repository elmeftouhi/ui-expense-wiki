import React, { useEffect } from 'react'
import { Bell } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useNotifications } from '../context'
import { NotificationList } from '../components/NotificationList'

export const NotificationsPage: React.FC = () => {
  const { registerViewer, unreadCount } = useNotifications()

  // Register as an active viewer while on the page
  useEffect(() => {
    const unregister = registerViewer()
    return unregister
  }, [registerViewer])

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Notification Center
              </h1>
              {unreadCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {unreadCount} unread
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Review expense alerts, subscription renewals, budget warnings and workspace updates.
            </p>
          </div>
        </div>
      </div>

      {/* Main Notifications Card */}
      <Card className="overflow-hidden border border-border/70 shadow-xs h-[calc(100vh-14rem)] min-h-[500px]">
        <CardContent className="p-0 h-full">
          <NotificationList className="h-full" />
        </CardContent>
      </Card>
    </div>
  )
}
