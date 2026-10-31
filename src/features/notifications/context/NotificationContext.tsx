import React, { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import { useAuth } from '@/features/auth'
import { useActiveTenant } from '@/features/tenants'
import { authStorage } from '@/features/auth/services/authStorage'
import { createFetchEventSource } from '../sse/fetchEventSource'
import { buildNotificationStreamUrl, notificationService, type NotificationApi } from '../services/notificationService'
import { createNotificationStore, type NotificationStore } from '../store/notificationStore'
import { startNotificationRealtime } from '../store/notificationRealtime'
import type {
  NotificationFilter,
  NotificationId,
} from '../types'
import { NotificationContext, type NotificationContextValue } from './context'

export interface NotificationProviderProps {
  children: React.ReactNode
  api?: NotificationApi
  enableRealtime?: boolean
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  api = notificationService,
  enableRealtime = true,
}) => {
  const { token, isAuthenticated } = useAuth()
  const { activeTenant } = useActiveTenant()
  const tenantId = activeTenant?.id

  // Create store instance per tenant. Recreated only when tenantId changes.
  const store = useMemo<NotificationStore | null>(() => {
    if (!isAuthenticated || !tenantId) return null
    return createNotificationStore({
      api,
      tenantId,
    })
  }, [api, isAuthenticated, tenantId])

  // Subscribe to external store updates via React 18/19 useSyncExternalStore
  const state = useSyncExternalStore(
    (onStoreChange) => store ? store.subscribe(onStoreChange) : () => {},
    () => store ? store.getState() : null,
    () => null,
  )

  // Initialize store and setup SSE stream + polling fallback
  useEffect(() => {
    if (!store || !tenantId) return

    void store.init()

    if (!enableRealtime) return

    const streamUrl = buildNotificationStreamUrl()
    const cleanupRealtime = startNotificationRealtime(store, {
      url: streamUrl,
      getHeaders: () => {
        const currentToken = token || authStorage.getToken() || ''
        const headers: Record<string, string> = {
          'X-Tenant-Id': String(tenantId),
        }
        if (currentToken) {
          headers['Authorization'] = `Bearer ${currentToken}`
        }
        return headers
      },
      eventSourceFactory: createFetchEventSource,
    })

    return () => {
      cleanupRealtime()
      store.cancelTimers()
    }
  }, [store, tenantId, token, enableRealtime])

  const setFilter = useCallback((f: NotificationFilter) => store ? store.setFilter(f) : Promise.resolve(), [store])
  const markAsRead = useCallback((id: NotificationId) => store ? store.markAsRead(id) : Promise.resolve(), [store])
  const archive = useCallback((id: NotificationId) => store ? store.archive(id) : Promise.resolve(), [store])
  const markAllAsRead = useCallback(() => store ? store.markAllAsRead() : Promise.resolve(), [store])
  const loadMore = useCallback(() => store ? store.loadMore() : Promise.resolve(), [store])
  const refresh = useCallback(() => store ? store.refreshFirstPage() : Promise.resolve(), [store])
  const resync = useCallback(() => store ? store.resync() : Promise.resolve(), [store])
  const registerViewer = useCallback(() => store ? store.registerViewer() : () => {}, [store])

  const contextValue = useMemo<NotificationContextValue | null>(() => {
    if (!store || !state) return null

    return {
      store,
      state,
      items: state.items,
      filter: state.filter,
      unreadCount: state.unreadCount ?? 0,
      streamStatus: state.streamStatus,
      isLoading: state.listStatus === 'loading',
      isLoadingMore: state.isLoadingMore,
      isRefreshing: state.isRefreshing,
      hasNext: state.hasNext,
      error: state.listError,
      setFilter,
      markAsRead,
      archive,
      markAllAsRead,
      loadMore,
      refresh,
      resync,
      registerViewer,
    }
  }, [
    store,
    state,
    setFilter,
    markAsRead,
    archive,
    markAllAsRead,
    loadMore,
    refresh,
    resync,
    registerViewer,
  ])

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  )
}
