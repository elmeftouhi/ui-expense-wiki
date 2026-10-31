import { describe, expect, it } from 'vitest'
import {
  createInitialNotificationState,
  matchesFilter,
  notificationReducer,
} from '../store/notificationReducer'
import type { Notification, NotificationPage } from '../types'

const makeNotification = (partial: Partial<Notification> = {}): Notification => ({
  id: 1,
  userId: 10,
  type: 'PAYMENT_REMINDER',
  status: 'SENT',
  title: 'Payment Reminder',
  message: 'Cloud hosting invoice due tomorrow',
  subjectType: 'EXPENSE',
  subjectId: 100,
  data: null,
  tenantId: 1,
  createdAt: '2026-10-31T10:00:00Z',
  readAt: null,
  archivedAt: null,
  ...partial,
})

describe('notificationReducer unit tests', () => {
  it('initializes with default empty state', () => {
    const state = createInitialNotificationState()
    expect(state.filter).toBe('ALL')
    expect(state.items).toEqual([])
    expect(state.unreadCount).toBeNull()
    expect(state.listStatus).toBe('idle')
  })

  it('switches filter and resets page state while keeping unread count', () => {
    let state = createInitialNotificationState({
      filter: 'ALL',
      unreadCount: 3,
      items: [makeNotification({ id: 1, status: 'SENT' })],
    })

    state = notificationReducer(state, { type: 'filter/set', filter: 'UNREAD' })

    expect(state.filter).toBe('UNREAD')
    expect(state.items).toEqual([])
    expect(state.unreadCount).toBe(3)
    expect(state.listStatus).toBe('loading')
    expect(state.listEpoch).toBe(1)
  })

  it('populates page items and indexes statuses on page/success', () => {
    let state = createInitialNotificationState({ listEpoch: 1 })
    const page: NotificationPage = {
      items: [
        makeNotification({ id: 1, status: 'SENT', createdAt: '2026-10-31T12:00:00Z' }),
        makeNotification({ id: 2, status: 'READ', createdAt: '2026-10-31T11:00:00Z' }),
      ],
      page: 0,
      size: 20,
      totalElements: 2,
      totalPages: 1,
      hasNext: false,
    }

    state = notificationReducer(state, {
      type: 'page/success',
      epoch: 1,
      mode: 'replace',
      page,
      receivedAt: 1234567890,
    })

    expect(state.listStatus).toBe('ready')
    expect(state.items).toHaveLength(2)
    expect(state.statusIndex['1']?.status).toBe('SENT')
    expect(state.statusIndex['2']?.status).toBe('READ')
  })

  it('performs optimistic mark-as-read and decrements unreadCount', () => {
    let state = createInitialNotificationState({
      unreadCount: 2,
      items: [
        makeNotification({ id: 1, status: 'SENT' }),
        makeNotification({ id: 2, status: 'SENT' }),
      ],
    })

    state = notificationReducer(state, {
      type: 'mutation/optimistic',
      opId: 101,
      id: 1,
      target: 'READ',
      at: '2026-10-31T12:30:00Z',
    })

    expect(state.items.find((i) => i.id === 1)?.status).toBe('READ')
    expect(state.unreadCount).toBe(1)
    expect(state.pending['1']).toBeDefined()
    expect(state.pending['1']?.target).toBe('READ')

    // Rollback on failure
    state = notificationReducer(state, { type: 'mutation/rollback', opId: 101 })
    expect(state.items.find((i) => i.id === 1)?.status).toBe('SENT')
    expect(state.unreadCount).toBe(2)
    expect(state.pending['1']).toBeUndefined()
  })

  it('performs optimistic archive and removes item from unread filter', () => {
    let state = createInitialNotificationState({
      filter: 'UNREAD',
      unreadCount: 1,
      items: [makeNotification({ id: 5, status: 'SENT' })],
    })

    state = notificationReducer(state, {
      type: 'mutation/optimistic',
      opId: 202,
      id: 5,
      target: 'ARCHIVED',
      at: '2026-10-31T13:00:00Z',
    })

    // Because filter is UNREAD, archived item is removed from items
    expect(state.items).toHaveLength(0)
    expect(state.unreadCount).toBe(0)
    expect(state.statusIndex['5']?.status).toBe('ARCHIVED')

    // Settle mutation
    state = notificationReducer(state, {
      type: 'mutation/settled',
      opId: 202,
      item: makeNotification({ id: 5, status: 'ARCHIVED' }),
    })
    expect(state.pending['5']).toBeUndefined()
  })

  it('performs optimistic mark-all-as-read and handles rollback', () => {
    let state = createInitialNotificationState({
      unreadCount: 3,
      items: [
        makeNotification({ id: 1, status: 'SENT' }),
        makeNotification({ id: 2, status: 'SENT' }),
        makeNotification({ id: 3, status: 'READ' }),
      ],
    })

    state = notificationReducer(state, {
      type: 'bulk/optimistic',
      opId: 303,
      at: '2026-10-31T14:00:00Z',
    })

    expect(state.unreadCount).toBe(0)
    expect(state.items.every((i) => i.status === 'READ')).toBe(true)
    expect(state.bulkPending).toBeDefined()

    // Rollback
    state = notificationReducer(state, { type: 'bulk/rollback', opId: 303 })
    expect(state.unreadCount).toBe(3)
    expect(state.items.find((i) => i.id === 1)?.status).toBe('SENT')
    expect(state.items.find((i) => i.id === 2)?.status).toBe('SENT')
    expect(state.bulkPending).toBeNull()
  })

  it('handles stream/created by inserting new item at the top and incrementing unreadCount', () => {
    let state = createInitialNotificationState({
      filter: 'ALL',
      listStatus: 'ready',
      unreadCount: 1,
      items: [makeNotification({ id: 1, createdAt: '2026-10-31T10:00:00Z' })],
    })

    const newItem = makeNotification({
      id: 2,
      title: 'New Expense Due',
      status: 'SENT',
      createdAt: '2026-10-31T11:00:00Z',
    })

    state = notificationReducer(state, { type: 'stream/created', item: newItem })

    expect(state.items).toHaveLength(2)
    expect(state.items[0].id).toBe(2)
    expect(state.unreadCount).toBe(2)
  })

  it('handles stream/updated by patching existing item and adjusting status', () => {
    let state = createInitialNotificationState({
      filter: 'UNREAD',
      listStatus: 'ready',
      unreadCount: 1,
      items: [makeNotification({ id: 1, status: 'SENT' })],
    })

    // Server says notification 1 is now READ
    const updatedItem = makeNotification({ id: 1, status: 'READ' })
    state = notificationReducer(state, { type: 'stream/updated', item: updatedItem })

    // In UNREAD filter, READ items are removed
    expect(state.items).toHaveLength(0)
    expect(state.unreadCount).toBe(0)
  })

  it('matchesFilter correctly evaluates statuses', () => {
    expect(matchesFilter({ status: 'SENT' }, 'ALL')).toBe(true)
    expect(matchesFilter({ status: 'SENT' }, 'UNREAD')).toBe(true)
    expect(matchesFilter({ status: 'READ' }, 'UNREAD')).toBe(false)
    expect(matchesFilter({ status: 'READ' }, 'READ')).toBe(true)
    expect(matchesFilter({ status: 'ARCHIVED' }, 'ARCHIVED')).toBe(true)
    expect(matchesFilter({ status: 'READ' }, 'ARCHIVED')).toBe(false)
  })
})
