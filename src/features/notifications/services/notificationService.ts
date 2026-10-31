import { apiClient } from '@/api/client'
import { API_CONFIG } from '@/api/config'
import {
  parseNotification,
  parseNotificationPage,
  parseUnreadCount,
} from '../schemas/notificationSchema'
import type {
  Notification,
  NotificationId,
  NotificationPage,
  NotificationPageQuery,
} from '../types'

const BASE = '/v1/notifications'

/**
 * Strongly typed client for the notifications API.
 * All calls go through the shared `apiClient`, which injects the Bearer JWT,
 * and pass `tenantId` so the tenant header is sent on every request.
 */
export interface NotificationApi {
  getPage(
    tenantId: NotificationId,
    query: NotificationPageQuery,
    signal?: AbortSignal,
  ): Promise<NotificationPage>
  getUnreadCount(tenantId: NotificationId, signal?: AbortSignal): Promise<number>
  /** Resolves with the updated notification when the backend returns one, otherwise `null`. */
  markAsRead(tenantId: NotificationId, id: NotificationId): Promise<Notification | null>
  markAsArchived(tenantId: NotificationId, id: NotificationId): Promise<Notification | null>
  markAllAsRead(tenantId: NotificationId): Promise<void>
}

const path = (id: NotificationId, action: string) =>
  `${BASE}/${encodeURIComponent(String(id))}/${action}`

export const notificationService: NotificationApi = {
  async getPage(tenantId, query, signal) {
    const raw = await apiClient.get<unknown>(`${BASE}/page`, {
      tenantId,
      signal,
      params: { page: query.page, size: query.size, status: query.status },
    })
    return parseNotificationPage(raw)
  },

  async getUnreadCount(tenantId, signal) {
    return parseUnreadCount(await apiClient.get<unknown>(`${BASE}/unread/count`, { tenantId, signal }))
  },

  async markAsRead(tenantId, id) {
    return parseNotification(await apiClient.patch<unknown>(path(id, 'mark-as-read'), undefined, { tenantId }))
  },

  async markAsArchived(tenantId, id) {
    return parseNotification(
      await apiClient.patch<unknown>(path(id, 'mark-as-archived'), undefined, { tenantId }),
    )
  },

  async markAllAsRead(tenantId) {
    await apiClient.post<unknown>(`${BASE}/mark-all-as-read`, undefined, { tenantId })
  },
}

/** Absolute (or same-origin relative) URL of the SSE endpoint. */
export function buildNotificationStreamUrl(baseUrl: string = API_CONFIG.baseUrl): string {
  return `${baseUrl.replace(/\/$/, '')}${BASE}/stream`
}

