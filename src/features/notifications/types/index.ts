/**
 * Notification Center domain contracts.
 *
 * Mirrors the backend `/v1/notifications` API. Status and type unions stay open
 * (`string & {}`) so a newly introduced backend value never crashes the UI; it
 * simply falls back to neutral styling.
 */

export const NOTIFICATION_STATUSES = ['SENT', 'READ', 'ARCHIVED'] as const
export type KnownNotificationStatus = (typeof NOTIFICATION_STATUSES)[number]
export type NotificationStatus = KnownNotificationStatus | (string & {})

export const NOTIFICATION_TYPES = [
  'PAYMENT_REMINDER',
  'SUBSCRIPTION_NEXT',
  'EXPENSE_DUE_SOON',
  'EXPENSE_OVERDUE',
  'BUDGET_ALERT',
  'BUDGET_EXCEEDED',
] as const
export type KnownNotificationType = (typeof NOTIFICATION_TYPES)[number]
export type NotificationType = KnownNotificationType | (string & {})

export type NotificationId = number | string

export interface Notification {
  id: NotificationId
  userId: NotificationId | null
  type: NotificationType
  status: NotificationStatus
  title: string
  message: string
  subjectType: string | null
  subjectId: NotificationId | null
  /** Free-form payload. JSON strings from the backend are parsed into objects. */
  data: Record<string, unknown> | null
  tenantId: NotificationId | null
  createdAt: string
  readAt: string | null
  archivedAt: string | null
}

export interface NotificationPage {
  items: Notification[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  hasNext: boolean
}

export interface NotificationPageQuery {
  page: number
  size: number
  status?: KnownNotificationStatus
}

export type NotificationFilter = 'ALL' | 'UNREAD' | 'READ' | 'ARCHIVED'

export const NOTIFICATION_FILTERS: ReadonlyArray<{ value: NotificationFilter; label: string }> = [
  { value: 'ALL', label: 'All' },
  { value: 'UNREAD', label: 'Unread' },
  { value: 'READ', label: 'Read' },
  { value: 'ARCHIVED', label: 'Archived' },
]

export const FILTER_TO_STATUS: Record<NotificationFilter, KnownNotificationStatus | undefined> = {
  ALL: undefined,
  UNREAD: 'SENT',
  READ: 'READ',
  ARCHIVED: 'ARCHIVED',
}

/**
 * - `idle`: realtime not started (signed out / disabled)
 * - `connecting`: first connection attempt in flight
 * - `online`: server confirmed the stream with a `connected` event
 * - `reconnecting`: waiting for / performing a backoff retry
 * - `offline`: stream gave up (e.g. 401/403); polling remains active
 */
export type StreamStatus = 'idle' | 'connecting' | 'online' | 'reconnecting' | 'offline'

export const NOTIFICATION_STREAM_EVENTS = [
  'connected',
  'notification-created',
  'notification-updated',
  'notifications-bulk-read',
] as const
export type NotificationStreamEvent = (typeof NOTIFICATION_STREAM_EVENTS)[number]

