import { NOTIFICATION_STREAM_EVENTS } from '../types'
import type { EventSourceFactory } from '../sse/fetchEventSource'
import { NotificationStreamManager, type BackoffOptions } from '../sse/notificationStreamManager'
import type { NotificationStore } from './notificationStore'

export const UNREAD_POLL_INTERVAL_MS = 30_000
export const PAGE_POLL_INTERVAL_MS = 60_000

export interface NotificationRealtimeOptions {
  url: string
  getHeaders: () => Record<string, string>
  eventSourceFactory: EventSourceFactory
  backoff?: BackoffOptions
  unreadPollIntervalMs?: number
  pagePollIntervalMs?: number
  onFatalError?: (error: unknown) => void
}

/**
 * Wires a store to the SSE stream and the polling fallback.
 *
 * Polling only does work while the stream is not `online`:
 * - unread count every 30s
 * - first page every 60s, and only while a notification panel/page is visible
 *
 * Returns a cleanup function that closes the stream and clears all timers.
 */
export function startNotificationRealtime(
  store: NotificationStore,
  options: NotificationRealtimeOptions,
): () => void {
  const manager = new NotificationStreamManager({
    url: options.url,
    getHeaders: options.getHeaders,
    factory: options.eventSourceFactory,
    events: NOTIFICATION_STREAM_EVENTS,
    backoff: options.backoff,
    onEvent: (type, payload) => store.handleStreamEvent(type, payload),
    onStatusChange: (status) => store.setStreamStatus(status),
    onReconnected: () => void store.resync(),
    onFatalError: options.onFatalError,
  })

  const isLive = () => store.getState().streamStatus === 'online'

  const unreadTimer = setInterval(() => {
    if (!isLive()) void store.refreshUnreadCount()
  }, options.unreadPollIntervalMs ?? UNREAD_POLL_INTERVAL_MS)

  const pageTimer = setInterval(() => {
    if (!isLive() && store.getState().viewerCount > 0) void store.refreshFirstPage()
  }, options.pagePollIntervalMs ?? PAGE_POLL_INTERVAL_MS)

  const handleOnline = () => manager.reconnectNow()
  if (typeof window !== 'undefined') window.addEventListener('online', handleOnline)

  manager.start()

  return () => {
    clearInterval(unreadTimer)
    clearInterval(pageTimer)
    if (typeof window !== 'undefined') window.removeEventListener('online', handleOnline)
    manager.stop()
  }
}

