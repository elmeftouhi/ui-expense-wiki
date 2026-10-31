import { describe, expect, it, vi } from 'vitest'
import { createNotificationStore } from '../store/notificationStore'
import type { NotificationApi } from '../services/notificationService'
import type { Notification, NotificationPage } from '../types'

const makeNotification = (partial: Partial<Notification> = {}): Notification => ({
  id: 1,
  userId: 10,
  type: 'PAYMENT_REMINDER',
  status: 'SENT',
  title: 'Payment Reminder',
  message: 'Invoice due tomorrow',
  subjectType: 'EXPENSE',
  subjectId: 100,
  data: null,
  tenantId: 1,
  createdAt: '2026-10-31T10:00:00Z',
  readAt: null,
  archivedAt: null,
  ...partial,
})

describe('NotificationStore unit & integration tests', () => {
  it('initializes by fetching unread count and first page', async () => {
    const page: NotificationPage = {
      items: [makeNotification({ id: 1, status: 'SENT' })],
      page: 0,
      size: 20,
      totalElements: 1,
      totalPages: 1,
      hasNext: false,
    }

    const mockApi: NotificationApi = {
      getPage: vi.fn().mockResolvedValue(page),
      getUnreadCount: vi.fn().mockResolvedValue(1),
      markAsRead: vi.fn(),
      markAsArchived: vi.fn(),
      markAllAsRead: vi.fn(),
    }

    const store = createNotificationStore({ api: mockApi, tenantId: 1 })
    await store.init()

    expect(mockApi.getUnreadCount).toHaveBeenCalledWith(1)
    expect(mockApi.getPage).toHaveBeenCalledWith(1, { page: 0, size: 20, status: undefined })
    expect(store.getState().unreadCount).toBe(1)
    expect(store.getState().items).toHaveLength(1)
    expect(store.getState().listStatus).toBe('ready')
  })

  it('switches filter and loads filtered first page', async () => {
    const mockApi: NotificationApi = {
      getPage: vi.fn().mockResolvedValue({
        items: [makeNotification({ id: 2, status: 'SENT' })],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
      }),
      getUnreadCount: vi.fn().mockResolvedValue(1),
      markAsRead: vi.fn(),
      markAsArchived: vi.fn(),
      markAllAsRead: vi.fn(),
    }

    const store = createNotificationStore({ api: mockApi, tenantId: 1 })
    await store.setFilter('UNREAD')

    expect(store.getState().filter).toBe('UNREAD')
    expect(mockApi.getPage).toHaveBeenCalledWith(1, { page: 0, size: 20, status: 'SENT' })
  })

  it('optimistically marks as read and handles server failure with rollback', async () => {
    const mockApi: NotificationApi = {
      getPage: vi.fn().mockResolvedValue({
        items: [makeNotification({ id: 1, status: 'SENT' })],
        page: 0,
        size: 20,
        totalElements: 1,
        totalPages: 1,
        hasNext: false,
      }),
      getUnreadCount: vi.fn().mockResolvedValue(1),
      markAsRead: vi.fn().mockRejectedValue(new Error('Network error')),
      markAsArchived: vi.fn(),
      markAllAsRead: vi.fn(),
    }

    const store = createNotificationStore({ api: mockApi, tenantId: 1 })
    await store.init()

    expect(store.getState().items[0].status).toBe('SENT')

    // Calling markAsRead should reject because the API fails, but rollback state
    await expect(store.markAsRead(1)).rejects.toThrow('Network error')

    // After failure, state rolled back to SENT
    expect(store.getState().items[0].status).toBe('SENT')
    expect(store.getState().unreadCount).toBe(1)
  })

  it('optimistically marks all as read and updates backend', async () => {
    const mockApi: NotificationApi = {
      getPage: vi.fn().mockResolvedValue({
        items: [
          makeNotification({ id: 1, status: 'SENT' }),
          makeNotification({ id: 2, status: 'SENT' }),
        ],
        page: 0,
        size: 20,
        totalElements: 2,
        totalPages: 1,
        hasNext: false,
      }),
      getUnreadCount: vi.fn().mockResolvedValue(2),
      markAsRead: vi.fn(),
      markAsArchived: vi.fn(),
      markAllAsRead: vi.fn().mockResolvedValue(undefined),
    }

    const store = createNotificationStore({ api: mockApi, tenantId: 1 })
    await store.init()

    await store.markAllAsRead()

    expect(mockApi.markAllAsRead).toHaveBeenCalledWith(1)
    expect(store.getState().items.every((i) => i.status === 'READ')).toBe(true)
    expect(store.getState().unreadCount).toBe(0)
  })

  it('handles incoming stream events for created and updated notifications', async () => {
    const mockApi: NotificationApi = {
      getPage: vi.fn().mockResolvedValue({
        items: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
      }),
      getUnreadCount: vi.fn().mockResolvedValue(0),
      markAsRead: vi.fn(),
      markAsArchived: vi.fn(),
      markAllAsRead: vi.fn(),
    }

    const store = createNotificationStore({ api: mockApi, tenantId: 1 })
    await store.init()

    store.handleStreamEvent(
      'notification-created',
      makeNotification({ id: 99, title: 'Budget Warning', status: 'SENT' }),
    )

    expect(store.getState().items).toHaveLength(1)
    expect(store.getState().items[0].id).toBe(99)
    expect(store.getState().unreadCount).toBe(1)

    // Update notification 99 to READ
    store.handleStreamEvent(
      'notification-updated',
      makeNotification({ id: 99, title: 'Budget Warning', status: 'READ' }),
    )

    expect(store.getState().items[0].status).toBe('READ')
    expect(store.getState().unreadCount).toBe(0)
  })

  it('discards stream events from a different tenantId for tenant isolation', async () => {
    const mockApi: NotificationApi = {
      getPage: vi.fn().mockResolvedValue({
        items: [],
        page: 0,
        size: 20,
        totalElements: 0,
        totalPages: 0,
        hasNext: false,
      }),
      getUnreadCount: vi.fn().mockResolvedValue(0),
      markAsRead: vi.fn(),
      markAsArchived: vi.fn(),
      markAllAsRead: vi.fn(),
    }

    const store = createNotificationStore({ api: mockApi, tenantId: 1 })
    await store.init()

    // Notification has tenantId 999 instead of 1
    store.handleStreamEvent(
      'notification-created',
      makeNotification({ id: 50, tenantId: 999 }),
    )

    expect(store.getState().items).toHaveLength(0)
    expect(store.getState().unreadCount).toBe(0)
  })
})

