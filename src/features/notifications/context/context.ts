import { createContext } from 'react'
import type { NotificationStore } from '../store/notificationStore'
import type { NotificationState } from '../store/notificationReducer'
import type {
  Notification,
  NotificationFilter,
  NotificationId,
  StreamStatus,
} from '../types'

export interface NotificationContextValue {
  store: NotificationStore
  state: NotificationState
  items: Notification[]
  filter: NotificationFilter
  unreadCount: number
  streamStatus: StreamStatus
  isLoading: boolean
  isLoadingMore: boolean
  isRefreshing: boolean
  hasNext: boolean
  error: string | null
  setFilter: (filter: NotificationFilter) => Promise<void>
  markAsRead: (id: NotificationId) => Promise<void>
  archive: (id: NotificationId) => Promise<void>
  markAllAsRead: () => Promise<void>
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  resync: () => Promise<void>
  registerViewer: () => () => void
}

export const NotificationContext = createContext<NotificationContextValue | null>(null)

