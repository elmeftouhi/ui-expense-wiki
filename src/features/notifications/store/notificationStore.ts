import { getApiErrorMessage } from '@/lib/api-error'
import { parseNotification } from '../schemas/notificationSchema'
import type { NotificationApi } from '../services/notificationService'
import type {
  KnownNotificationStatus,
  Notification,
  NotificationFilter,
  NotificationId,
  StreamStatus,
} from '../types'
import { FILTER_TO_STATUS } from '../types'
import {
  createInitialNotificationState,
  hasPendingMutations,
  notificationKey,
  notificationReducer,
  statusRank,
  type NotificationAction,
  type NotificationState,
  type PageLoadMode,
} from './notificationReducer'

export interface NotificationStoreOptions {
  api: NotificationApi
  tenantId: NotificationId
  pageSize?: number
  /** Debounce before re-fetching the unread count after it became uncertain. */
  countResyncDelayMs?: number
  now?: () => Date
}

export interface NotificationStore {
  getState(): NotificationState
  subscribe(listener: () => void): () => void
  /** Initial load: unread count + first page of the active filter. */
  init(): Promise<void>
  setFilter(filter: NotificationFilter): Promise<void>
  loadMore(): Promise<void>
  refreshFirstPage(): Promise<void>
  refreshUnreadCount(): Promise<void>
  /** Re-fetches count and first page (after reconnect or bulk events). */
  resync(): Promise<void>
  /** Optimistic; rolls back and rethrows on failure. */
  markAsRead(id: NotificationId): Promise<void>
  archive(id: NotificationId): Promise<void>
  markAllAsRead(): Promise<void>
  handleStreamEvent(type: string, payload: unknown): void
  setStreamStatus(status: StreamStatus): void
  /** Registers a visible list (panel/page); returns an unregister function. */
  registerViewer(): () => void
  /** Cancels internal timers. The store remains usable. */
  cancelTimers(): void
}

/**
 * Framework-agnostic external store (consumed via `useSyncExternalStore`).
 * Centralizes list + unread count, sequences async work, and enforces the
 * optimistic/rollback contract defined in the reducer.
 */
export function createNotificationStore(options: NotificationStoreOptions): NotificationStore {
  const { api, tenantId, pageSize = 20, countResyncDelayMs = 800, now = () => new Date() } = options

  let state = createInitialNotificationState()
  const listeners = new Set<() => void>()
  let opSequence = 0
  let countSequence = 0
  let countDirty = false
  let countResyncTimer: ReturnType<typeof setTimeout> | null = null
  let inFlightPage: Promise<void> | null = null

  const getState = () => state

  const scheduleCountResync = () => {
    if (countResyncTimer !== null) return
    countResyncTimer = setTimeout(() => {
      countResyncTimer = null
      void refreshUnreadCount()
    }, countResyncDelayMs)
  }

  const dispatch = (action: NotificationAction) => {
    const next = notificationReducer(state, action)
    if (next === state) return
    state = next
    listeners.forEach((listener) => listener())
    if ((state.unreadCountStale || countDirty) && !hasPendingMutations(state)) {
      scheduleCountResync()
    }
  }

  async function refreshUnreadCount(): Promise<void> {
    const sequence = ++countSequence
    const versionAtRequest = state.unreadVersion
    try {
      const count = await api.getUnreadCount(tenantId)
      if (sequence !== countSequence) return
      // A local change or in-flight mutation may make this response stale; retry later.
      if (state.unreadVersion !== versionAtRequest || hasPendingMutations(state)) {
        countDirty = true
        if (!hasPendingMutations(state)) scheduleCountResync()
        return
      }
      countDirty = false
      dispatch({ type: 'unread/set', count })
    } catch (error) {
      if (sequence !== countSequence) return
      dispatch({ type: 'unread/failure', error: getApiErrorMessage(error, 'Unable to load unread notifications.') })
    }
  }

  async function fetchPage(mode: PageLoadMode, pageIndex: number): Promise<void> {
    const epoch = state.listEpoch
    const status = FILTER_TO_STATUS[state.filter]
    dispatch({ type: 'page/request', epoch, mode })
    try {
      const page = await api.getPage(tenantId, { page: pageIndex, size: pageSize, status })
      dispatch({ type: 'page/success', epoch, mode, page, receivedAt: now().getTime() })
    } catch (error) {
      dispatch({
        type: 'page/failure',
        epoch,
        mode,
        error: getApiErrorMessage(error, 'Unable to load notifications.'),
      })
    }
  }

  const loadFirstPage = () => {
    const promise = fetchPage('replace', 0)
    inFlightPage = promise
    void promise.finally(() => {
      if (inFlightPage === promise) inFlightPage = null
    })
    return promise
  }

  async function refreshFirstPage(): Promise<void> {
    if (state.listStatus === 'idle' || state.listStatus === 'error') return loadFirstPage()
    if (state.listStatus === 'loading' || state.isRefreshing) return inFlightPage ?? undefined
    return fetchPage('refresh', 0)
  }

  async function mutate(id: NotificationId, target: KnownNotificationStatus): Promise<void> {
    const key = notificationKey(id)
    const item = state.items.find((candidate) => notificationKey(candidate.id) === key)
    if (!item || state.pending[key] || statusRank(item.status) >= statusRank(target)) return

    const opId = ++opSequence
    dispatch({ type: 'mutation/optimistic', opId, id, target, at: now().toISOString() })
    try {
      const updated =
        target === 'READ' ? await api.markAsRead(tenantId, id) : await api.markAsArchived(tenantId, id)
      dispatch({ type: 'mutation/settled', opId, item: updated })
    } catch (error) {
      dispatch({ type: 'mutation/rollback', opId })
      throw error
    }
  }

  const store: NotificationStore = {
    getState,

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    async init() {
      await Promise.all([refreshUnreadCount(), loadFirstPage()])
    },

    async setFilter(filter) {
      if (filter === state.filter && state.listStatus !== 'idle') return
      dispatch({ type: 'filter/set', filter })
      await loadFirstPage()
    },

    async loadMore() {
      if (state.listStatus !== 'ready' || !state.hasNext || state.isLoadingMore) return
      await fetchPage('append', state.page + 1)
    },

    refreshFirstPage,
    refreshUnreadCount,

    async resync() {
      await Promise.all([refreshUnreadCount(), refreshFirstPage()])
    },

    markAsRead: (id) => mutate(id, 'READ'),
    archive: (id) => mutate(id, 'ARCHIVED'),

    async markAllAsRead() {
      if (state.bulkPending) return
      const hasUnread = (state.unreadCount ?? 0) > 0 || state.items.some((item) => item.status === 'SENT')
      if (!hasUnread) return
      const opId = ++opSequence
      dispatch({ type: 'bulk/optimistic', opId, at: now().toISOString() })
      try {
        await api.markAllAsRead(tenantId)
        dispatch({ type: 'bulk/settled', opId })
      } catch (error) {
        dispatch({ type: 'bulk/rollback', opId })
        throw error
      }
    },

    handleStreamEvent(type, payload) {
      switch (type) {
        case 'notification-created':
        case 'notification-updated': {
          const item = parseNotification(payload)
          if (!item) return
          // Defense in depth: never surface another tenant's notification.
          if (item.tenantId !== null && String(item.tenantId) !== String(tenantId)) return
          dispatch({ type: type === 'notification-created' ? 'stream/created' : 'stream/updated', item })
          return
        }
        case 'notifications-bulk-read':
          void store.resync()
          return
        case 'connected':
          dispatch({ type: 'stream/status', status: 'online' })
          return
        default:
          return
      }
    },

    setStreamStatus(status) {
      dispatch({ type: 'stream/status', status })
    },

    registerViewer() {
      dispatch({ type: 'viewer/change', delta: 1 })
      let registered = true
      return () => {
        if (!registered) return
        registered = false
        dispatch({ type: 'viewer/change', delta: -1 })
      }
    },

    cancelTimers() {
      if (countResyncTimer !== null) {
        clearTimeout(countResyncTimer)
        countResyncTimer = null
      }
    },
  }

  return store
}

export type { Notification }

