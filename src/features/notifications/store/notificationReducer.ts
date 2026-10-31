import type {
  KnownNotificationStatus,
  Notification,
  NotificationFilter,
  NotificationPage,
  NotificationStatus,
  StreamStatus,
} from '../types'
import { FILTER_TO_STATUS } from '../types'

/**
 * Pure reducer for the Notification Center.
 *
 * Race-condition model
 * --------------------
 * Notification status only moves forward: SENT → READ → ARCHIVED. `statusIndex`
 * remembers the most advanced status seen for every id (from pages, SSE, or
 * optimistic actions). Any incoming item with a *lower* status is treated as stale
 * and upgraded to the known status, so an out-of-date page response or a late SSE
 * event can never undo a newer change. Only an explicit rollback lowers the index.
 *
 * Optimistic mutations are tracked in `pending`. An SSE update that reaches the
 * optimistic target marks the mutation `confirmed`; if the HTTP call then fails, the
 * rollback is skipped because the server has already applied the change.
 */

export type ListStatus = 'idle' | 'loading' | 'ready' | 'error'
export type PageLoadMode = 'replace' | 'append' | 'refresh'

export interface StatusSnapshot {
  status: NotificationStatus
  readAt: string | null
  archivedAt: string | null
}

export interface PendingMutation {
  opId: number
  key: string
  target: KnownNotificationStatus
  previous: Notification
  /** Change applied to `unreadCount` by this mutation (reversed on rollback). */
  unreadDelta: number
  confirmed: boolean
}

export interface BulkPending {
  opId: number
  previousUnreadCount: number | null
  /** Index entries switched to READ that were not part of the loaded list. */
  indexSnapshots: Record<string, StatusSnapshot>
}

export interface NotificationState {
  filter: NotificationFilter
  items: Notification[]
  /** Zero-based index of the last loaded page; -1 when nothing is loaded. */
  page: number
  hasNext: boolean
  totalElements: number
  listStatus: ListStatus
  listError: string | null
  isLoadingMore: boolean
  loadMoreError: string | null
  isRefreshing: boolean
  /** Incremented on filter change/reset so in-flight responses for an old list are dropped. */
  listEpoch: number
  unreadCount: number | null
  unreadCountError: string | null
  /** Set when a local change could not be applied precisely; the store re-fetches the count. */
  unreadCountStale: boolean
  /** Incremented whenever `unreadCount` changes locally; guards against stale count responses. */
  unreadVersion: number
  statusIndex: Record<string, StatusSnapshot>
  pending: Record<string, PendingMutation>
  bulkPending: BulkPending | null
  streamStatus: StreamStatus
  /** Number of mounted panels/pages currently showing the list (drives page polling). */
  viewerCount: number
  lastSyncedAt: number | null
}

export type NotificationAction =
  | { type: 'reset' }
  | { type: 'filter/set'; filter: NotificationFilter }
  | { type: 'page/request'; epoch: number; mode: PageLoadMode }
  | { type: 'page/success'; epoch: number; mode: PageLoadMode; page: NotificationPage; receivedAt: number }
  | { type: 'page/failure'; epoch: number; mode: PageLoadMode; error: string }
  | { type: 'unread/set'; count: number }
  | { type: 'unread/failure'; error: string }
  | { type: 'mutation/optimistic'; opId: number; id: Notification['id']; target: KnownNotificationStatus; at: string }
  | { type: 'mutation/settled'; opId: number; item: Notification | null }
  | { type: 'mutation/rollback'; opId: number }
  | { type: 'bulk/optimistic'; opId: number; at: string }
  | { type: 'bulk/settled'; opId: number }
  | { type: 'bulk/rollback'; opId: number }
  | { type: 'stream/created'; item: Notification }
  | { type: 'stream/updated'; item: Notification }
  | { type: 'stream/status'; status: StreamStatus }
  | { type: 'viewer/change'; delta: 1 | -1 }

export function createInitialNotificationState(
  overrides: Partial<NotificationState> = {},
): NotificationState {
  return {
    filter: 'ALL',
    items: [],
    page: -1,
    hasNext: false,
    totalElements: 0,
    listStatus: 'idle',
    listError: null,
    isLoadingMore: false,
    loadMoreError: null,
    isRefreshing: false,
    listEpoch: 0,
    unreadCount: null,
    unreadCountError: null,
    unreadCountStale: false,
    unreadVersion: 0,
    statusIndex: {},
    pending: {},
    bulkPending: null,
    streamStatus: 'idle',
    viewerCount: 0,
    lastSyncedAt: null,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const notificationKey = (id: Notification['id']): string => String(id)

const STATUS_RANK: Record<string, number> = { SENT: 0, READ: 1, ARCHIVED: 2 }
export const statusRank = (status: NotificationStatus): number => STATUS_RANK[status] ?? 0

export function matchesFilter(item: Pick<Notification, 'status'>, filter: NotificationFilter): boolean {
  const required = FILTER_TO_STATUS[filter]
  return required === undefined || item.status === required
}

const timeOf = (item: Notification): number => {
  const value = Date.parse(item.createdAt)
  return Number.isNaN(value) ? 0 : value
}

/** Newest first; ties broken by id (descending) for a stable order. */
export function compareNotifications(a: Notification, b: Notification): number {
  const diff = timeOf(b) - timeOf(a)
  if (diff !== 0) return diff
  const ak = notificationKey(a.id)
  const bk = notificationKey(b.id)
  const an = Number(ak)
  const bn = Number(bk)
  if (!Number.isNaN(an) && !Number.isNaN(bn)) return bn - an
  return bk.localeCompare(ak)
}

const snapshotOf = (item: StatusSnapshot): StatusSnapshot => ({
  status: item.status,
  readAt: item.readAt,
  archivedAt: item.archivedAt,
})

/** Upgrades `item` to `known` when `known` is further along the lifecycle. */
function applyKnownStatus(item: Notification, known: StatusSnapshot | undefined): Notification {
  if (!known || statusRank(known.status) <= statusRank(item.status)) return item
  return {
    ...item,
    status: known.status,
    readAt: item.readAt ?? known.readAt,
    archivedAt: item.archivedAt ?? known.archivedAt,
  }
}

/** Keeps the more advanced version; on a tie the incoming (fresher) one wins. */
function preferNewer(existing: Notification, incoming: Notification): Notification {
  return statusRank(existing.status) > statusRank(incoming.status) ? existing : incoming
}

/** Deduplicates by id and sorts newest first. Later entries win ties. */
export function mergeUnique(items: Notification[]): Notification[] {
  const byKey = new Map<string, Notification>()
  for (const item of items) {
    const key = notificationKey(item.id)
    const existing = byKey.get(key)
    byKey.set(key, existing ? preferNewer(existing, item) : item)
  }
  return Array.from(byKey.values()).sort(compareNotifications)
}

function withIndexed(
  index: Record<string, StatusSnapshot>,
  item: Notification,
): Record<string, StatusSnapshot> {
  const key = notificationKey(item.id)
  const known = index[key]
  if (known && statusRank(known.status) >= statusRank(item.status)) return index
  return { ...index, [key]: snapshotOf(item) }
}

function patchStatus(item: Notification, target: KnownNotificationStatus, at: string): Notification {
  return {
    ...item,
    status: target,
    readAt: target === 'READ' ? (item.readAt ?? at) : item.readAt,
    archivedAt: target === 'ARCHIVED' ? (item.archivedAt ?? at) : item.archivedAt,
  }
}

/** Could `item` belong to the currently loaded window without creating a gap? */
function isWithinLoadedWindow(state: NotificationState, item: Notification): boolean {
  if (state.listStatus !== 'ready') return false
  if (!state.hasNext || state.items.length === 0) return true
  const oldest = state.items[state.items.length - 1]
  return compareNotifications(item, oldest) <= 0
}

function adjustUnread(state: NotificationState, delta: number): Pick<NotificationState, 'unreadCount' | 'unreadVersion'> {
  if (delta === 0) return { unreadCount: state.unreadCount, unreadVersion: state.unreadVersion }
  return {
    unreadCount: state.unreadCount === null ? null : Math.max(0, state.unreadCount + delta),
    unreadVersion: state.unreadVersion + 1,
  }
}

const unreadDeltaFor = (from: NotificationStatus, to: NotificationStatus): number => {
  const wasUnread = from === 'SENT'
  const isUnread = to === 'SENT'
  if (wasUnread === isUnread) return 0
  return isUnread ? 1 : -1
}

/**
 * Applies a server-originated version of an item (SSE or mutation response).
 * Monotonic: never moves an item backwards in its lifecycle.
 */
function applyIncoming(state: NotificationState, raw: Notification, insertIfMissing: boolean): NotificationState {
  const key = notificationKey(raw.id)
  const listIndex = state.items.findIndex((item) => notificationKey(item.id) === key)
  const listItem = listIndex === -1 ? undefined : state.items[listIndex]
  const known = state.statusIndex[key]
  const knownStatus = listItem?.status ?? known?.status

  let merged = applyKnownStatus(raw, known)
  if (listItem) merged = applyKnownStatus(merged, snapshotOf(listItem))
  const pending = state.pending[key]
  if (pending && statusRank(merged.status) < statusRank(pending.target)) {
    merged = patchStatus(merged, pending.target, new Date().toISOString())
  }

  let items = state.items
  if (listItem) {
    items = matchesFilter(merged, state.filter)
      ? state.items.map((item, i) => (i === listIndex ? merged : item))
      : state.items.filter((_, i) => i !== listIndex)
  } else if (insertIfMissing && matchesFilter(merged, state.filter) && isWithinLoadedWindow(state, merged)) {
    items = mergeUnique([...state.items, merged])
  }

  let unreadStale = state.unreadCountStale
  let unread = { unreadCount: state.unreadCount, unreadVersion: state.unreadVersion }
  if (knownStatus === undefined) {
    // We cannot know whether this changed the unread total — ask the server.
    unreadStale = true
  } else {
    unread = adjustUnread(state, unreadDeltaFor(knownStatus, merged.status))
  }

  return {
    ...state,
    items,
    statusIndex: withIndexed(state.statusIndex, merged),
    unreadCountStale: unreadStale,
    ...unread,
  }
}

function insertRestored(state: NotificationState, previous: Notification): Notification[] {
  const key = notificationKey(previous.id)
  const without = state.items.filter((item) => notificationKey(item.id) !== key)
  if (!matchesFilter(previous, state.filter)) return without
  return mergeUnique([...without, previous])
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'reset':
      return createInitialNotificationState({
        listEpoch: state.listEpoch + 1,
        streamStatus: state.streamStatus,
        viewerCount: state.viewerCount,
      })

    case 'filter/set': {
      if (action.filter === state.filter) return state
      return {
        ...state,
        filter: action.filter,
        items: [],
        page: -1,
        hasNext: false,
        totalElements: 0,
        listStatus: 'loading',
        listError: null,
        isLoadingMore: false,
        loadMoreError: null,
        isRefreshing: false,
        listEpoch: state.listEpoch + 1,
      }
    }

    case 'page/request': {
      if (action.epoch !== state.listEpoch) return state
      if (action.mode === 'replace') return { ...state, listStatus: 'loading', listError: null }
      if (action.mode === 'append') return { ...state, isLoadingMore: true, loadMoreError: null }
      return { ...state, isRefreshing: true }
    }

    case 'page/failure': {
      if (action.epoch !== state.listEpoch) return state
      if (action.mode === 'replace') return { ...state, listStatus: 'error', listError: action.error }
      if (action.mode === 'append') return { ...state, isLoadingMore: false, loadMoreError: action.error }
      return { ...state, isRefreshing: false }
    }

    case 'page/success': {
      if (action.epoch !== state.listEpoch) return state
      const { page } = action

      let statusIndex = state.statusIndex
      const incoming: Notification[] = []
      for (const raw of page.items) {
        const key = notificationKey(raw.id)
        let item = applyKnownStatus(raw, statusIndex[key])
        const pending = state.pending[key]
        if (pending && statusRank(item.status) < statusRank(pending.target)) {
          item = patchStatus(item, pending.target, new Date(action.receivedAt).toISOString())
        }
        statusIndex = withIndexed(statusIndex, item)
        if (matchesFilter(item, state.filter)) incoming.push(item)
      }

      const base = {
        ...state,
        statusIndex,
        totalElements: page.totalElements,
        lastSyncedAt: action.receivedAt,
      }

      if (action.mode === 'replace') {
        return {
          ...base,
          items: mergeUnique(incoming),
          page: page.page,
          hasNext: page.hasNext,
          listStatus: 'ready',
          listError: null,
        }
      }

      if (action.mode === 'append') {
        return {
          ...base,
          items: mergeUnique([...state.items, ...incoming]),
          page: Math.max(state.page, page.page),
          hasNext: page.hasNext,
          isLoadingMore: false,
          loadMoreError: null,
        }
      }

      // refresh: the first page is authoritative for its time window; keep older, already-loaded items.
      if (!page.hasNext || page.items.length === 0) {
        return { ...base, items: mergeUnique(incoming), page: 0, hasNext: page.hasNext, isRefreshing: false, listStatus: 'ready', listError: null }
      }
      const oldestOnPage = [...page.items].sort(compareNotifications)[page.items.length - 1]
      const incomingKeys = new Set(page.items.map((item) => notificationKey(item.id)))
      const olderLoaded = state.items.filter(
        (item) => !incomingKeys.has(notificationKey(item.id)) && compareNotifications(item, oldestOnPage) > 0,
      )
      const loadedBeyondFirstPage = state.page > 0
      return {
        ...base,
        items: mergeUnique([...olderLoaded, ...incoming]),
        page: Math.max(state.page, 0),
        hasNext: loadedBeyondFirstPage ? state.hasNext : page.hasNext,
        isRefreshing: false,
        listStatus: 'ready',
        listError: null,
      }
    }

    case 'unread/set':
      return {
        ...state,
        unreadCount: action.count,
        unreadCountError: null,
        unreadCountStale: false,
      }

    case 'unread/failure':
      return { ...state, unreadCountError: action.error }

    case 'mutation/optimistic': {
      const key = notificationKey(action.id)
      if (state.pending[key]) return state
      const listIndex = state.items.findIndex((item) => notificationKey(item.id) === key)
      if (listIndex === -1) return state
      const previous = state.items[listIndex]
      if (statusRank(previous.status) >= statusRank(action.target)) return state

      const updated = patchStatus(previous, action.target, action.at)
      const unreadDelta = unreadDeltaFor(previous.status, updated.status)
      const items = matchesFilter(updated, state.filter)
        ? state.items.map((item, i) => (i === listIndex ? updated : item))
        : state.items.filter((_, i) => i !== listIndex)

      return {
        ...state,
        items,
        statusIndex: { ...state.statusIndex, [key]: snapshotOf(updated) },
        pending: {
          ...state.pending,
          [key]: { opId: action.opId, key, target: action.target, previous, unreadDelta, confirmed: false },
        },
        ...adjustUnread(state, unreadDelta),
      }
    }

    case 'mutation/settled': {
      const pending = { ...state.pending }
      let changed = false
      for (const [key, entry] of Object.entries(pending)) {
        if (entry.opId === action.opId) {
          delete pending[key]
          changed = true
        }
      }
      if (!changed && !action.item) return state
      const next = { ...state, pending }
      return action.item ? applyIncoming(next, action.item, false) : next
    }

    case 'mutation/rollback': {
      let next = state
      for (const entry of Object.values(state.pending)) {
        if (entry.opId !== action.opId) continue
        const pending = { ...next.pending }
        delete pending[entry.key]
        if (entry.confirmed) {
          next = { ...next, pending }
          continue
        }
        next = {
          ...next,
          pending,
          items: insertRestored(next, entry.previous),
          statusIndex: { ...next.statusIndex, [entry.key]: snapshotOf(entry.previous) },
          ...adjustUnread(next, -entry.unreadDelta),
        }
      }
      return next
    }

    case 'bulk/optimistic': {
      if (state.bulkPending) return state
      const pending = { ...state.pending }
      const statusIndex = { ...state.statusIndex }
      const indexSnapshots: Record<string, StatusSnapshot> = {}

      const items: Notification[] = []
      for (const item of state.items) {
        const key = notificationKey(item.id)
        if (item.status !== 'SENT' || pending[key]) {
          items.push(item)
          continue
        }
        const updated = patchStatus(item, 'READ', action.at)
        pending[key] = { opId: action.opId, key, target: 'READ', previous: item, unreadDelta: 0, confirmed: false }
        statusIndex[key] = snapshotOf(updated)
        if (matchesFilter(updated, state.filter)) items.push(updated)
      }
      // Unread items we know about from other lists/filters.
      for (const [key, snapshot] of Object.entries(state.statusIndex)) {
        if (snapshot.status !== 'SENT' || pending[key]) continue
        indexSnapshots[key] = snapshot
        statusIndex[key] = { ...snapshot, status: 'READ', readAt: snapshot.readAt ?? action.at }
      }

      return {
        ...state,
        items,
        pending,
        statusIndex,
        bulkPending: { opId: action.opId, previousUnreadCount: state.unreadCount, indexSnapshots },
        unreadCount: state.unreadCount === null ? null : 0,
        unreadVersion: state.unreadVersion + 1,
      }
    }

    case 'bulk/settled': {
      if (state.bulkPending?.opId !== action.opId) return state
      const pending = Object.fromEntries(
        Object.entries(state.pending).filter(([, entry]) => entry.opId !== action.opId),
      )
      return { ...state, pending, bulkPending: null, unreadCountStale: true }
    }

    case 'bulk/rollback': {
      const bulk = state.bulkPending
      if (bulk?.opId !== action.opId) return state
      let next: NotificationState = { ...state, bulkPending: null }
      next = notificationReducer(next, { type: 'mutation/rollback', opId: action.opId })
      const statusIndex = { ...next.statusIndex }
      for (const [key, snapshot] of Object.entries(bulk.indexSnapshots)) {
        if (statusIndex[key]?.status === 'READ') statusIndex[key] = snapshot
      }
      return {
        ...next,
        statusIndex,
        unreadCount:
          bulk.previousUnreadCount === null ? next.unreadCount : (next.unreadCount ?? 0) + bulk.previousUnreadCount,
        unreadVersion: next.unreadVersion + 1,
        unreadCountStale: true,
      }
    }

    case 'stream/created': {
      const key = notificationKey(action.item.id)
      const alreadyKnown =
        state.statusIndex[key] !== undefined || state.items.some((item) => notificationKey(item.id) === key)
      if (alreadyKnown) return applyIncoming(state, action.item, true)

      const item = action.item
      const shouldInsert = matchesFilter(item, state.filter) && isWithinLoadedWindow(state, item)
      return {
        ...state,
        items: shouldInsert ? mergeUnique([item, ...state.items]) : state.items,
        totalElements: shouldInsert ? state.totalElements + 1 : state.totalElements,
        statusIndex: withIndexed(state.statusIndex, item),
        ...adjustUnread(state, item.status === 'SENT' ? 1 : 0),
      }
    }

    case 'stream/updated': {
      const key = notificationKey(action.item.id)
      const pending = state.pending[key]
      if (pending) {
        if (statusRank(action.item.status) < statusRank(pending.target)) {
          // Event predates our optimistic change — ignore it.
          return state
        }
        const confirmed = { ...state, pending: { ...state.pending, [key]: { ...pending, confirmed: true } } }
        return applyIncoming(confirmed, action.item, true)
      }
      return applyIncoming(state, action.item, true)
    }

    case 'stream/status':
      return state.streamStatus === action.status ? state : { ...state, streamStatus: action.status }

    case 'viewer/change':
      return { ...state, viewerCount: Math.max(0, state.viewerCount + action.delta) }

    default:
      return state
  }
}

export const hasPendingMutations = (state: NotificationState): boolean =>
  state.bulkPending !== null || Object.keys(state.pending).length > 0

export const isNotificationPending = (state: NotificationState, id: Notification['id']): boolean =>
  state.pending[notificationKey(id)] !== undefined
