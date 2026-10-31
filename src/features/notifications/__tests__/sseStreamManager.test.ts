import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createSseParser, type ParsedSseEvent } from '../sse/sseParser'
import {
  computeBackoffDelay,
  isFatalStreamError,
  NotificationStreamManager,
} from '../sse/notificationStreamManager'
import { SseHttpError, type EventSourceFactory, type EventSourceLike, type StreamMessageEvent } from '../sse/fetchEventSource'

describe('createSseParser', () => {
  it('parses standard SSE events and multiline data', () => {
    const events: ParsedSseEvent[] = []
    const parser = createSseParser((e) => events.push(e))

    parser.push('event: notification-created\n')
    parser.push('data: {"id":1,"title":"Invoice"}\n\n')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual({
      event: 'notification-created',
      data: '{"id":1,"title":"Invoice"}',
      id: undefined,
      retry: undefined,
    })
  })

  it('handles chunk boundaries split across line breaks and ignores comment heartbeats', () => {
    const events: ParsedSseEvent[] = []
    const parser = createSseParser((e) => events.push(e))

    parser.push(': ping\n')
    parser.push('event: co')
    parser.push('nnected\n')
    parser.push('data: ok\n\n')

    expect(events).toHaveLength(1)
    expect(events[0].event).toBe('connected')
    expect(events[0].data).toBe('ok')
  })
})

describe('computeBackoffDelay & isFatalStreamError', () => {
  it('calculates exponential backoff capped at maxDelayMs', () => {
    expect(computeBackoffDelay(0, { initialDelayMs: 1000, factor: 2, maxDelayMs: 30000 })).toBe(1000)
    expect(computeBackoffDelay(1, { initialDelayMs: 1000, factor: 2, maxDelayMs: 30000 })).toBe(2000)
    expect(computeBackoffDelay(2, { initialDelayMs: 1000, factor: 2, maxDelayMs: 30000 })).toBe(4000)
    expect(computeBackoffDelay(5, { initialDelayMs: 1000, factor: 2, maxDelayMs: 30000 })).toBe(30000)
  })

  it('detects fatal 401 and 403 HTTP errors', () => {
    expect(isFatalStreamError(new SseHttpError(401))).toBe(true)
    expect(isFatalStreamError(new SseHttpError(403))).toBe(true)
    expect(isFatalStreamError(new SseHttpError(500))).toBe(false)
    expect(isFatalStreamError(new Error('network error'))).toBe(false)
  })
})

describe('NotificationStreamManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('connects, dispatches connected event and sets status to online', () => {
    const listeners = new Map<string, (e: StreamMessageEvent) => void>()
    let mockClosed = false

    const mockFactory: EventSourceFactory = vi.fn((_url, _init) => {
      const source: EventSourceLike = {
        onopen: null,
        onerror: null,
        addEventListener: (type, listener) => {
          listeners.set(type, listener)
        },
        close: () => {
          mockClosed = true
        },
      }
      return source
    })

    const onEvent = vi.fn()
    const onStatusChange = vi.fn()

    const manager = new NotificationStreamManager({
      url: '/v1/notifications/stream',
      getHeaders: () => ({ Authorization: 'Bearer token-123' }),
      factory: mockFactory,
      events: ['connected', 'notification-created'],
      onEvent,
      onStatusChange,
    })

    manager.start()

    expect(mockFactory).toHaveBeenCalledWith('/v1/notifications/stream', {
      headers: { Authorization: 'Bearer token-123' },
    })

    // Simulate connected event from server
    listeners.get('connected')?.({ data: 'connected' })

    expect(manager.currentStatus).toBe('online')
    expect(onEvent).toHaveBeenCalledWith('connected', 'connected')
    expect(onStatusChange).toHaveBeenCalledWith('online')

    manager.stop()
    expect(mockClosed).toBe(true)
    expect(manager.currentStatus).toBe('idle')
  })

  it('reconnects with exponential backoff on connection error', () => {
    let sourceOnError: (err: unknown) => void = () => {}
    const listeners = new Map<string, (e: StreamMessageEvent) => void>()
    let connectAttempts = 0

    const mockFactory: EventSourceFactory = vi.fn(() => {
      connectAttempts++
      const source: EventSourceLike = {
        onopen: null,
        onerror: null,
        addEventListener: (type, listener) => {
          listeners.set(type, listener)
        },
        close: vi.fn(),
      }
      setTimeout(() => {
        if (source.onerror) sourceOnError = source.onerror
      }, 0)
      return source
    })

    const onReconnected = vi.fn()
    const onStatusChange = vi.fn()

    const manager = new NotificationStreamManager({
      url: '/v1/notifications/stream',
      getHeaders: () => ({ Authorization: 'Bearer token-123' }),
      factory: mockFactory,
      events: ['connected', 'notification-created'],
      onEvent: vi.fn(),
      onStatusChange,
      onReconnected,
      backoff: { initialDelayMs: 500, factor: 2 },
    })

    manager.start()
    expect(connectAttempts).toBe(1)

    // Mark as connected once
    listeners.get('connected')?.({ data: 'connected' })
    expect(manager.currentStatus).toBe('online')

    // Simulate connection drop
    vi.runAllTimers()
    sourceOnError?.(new Error('Connection lost'))

    expect(manager.currentStatus).toBe('reconnecting')

    // Fast-forward 500ms backoff
    vi.advanceTimersByTime(500)
    expect(connectAttempts).toBe(2)

    // Second connection succeeds with connected
    listeners.get('connected')?.({ data: 'connected' })
    expect(manager.currentStatus).toBe('online')
    expect(onReconnected).toHaveBeenCalledOnce()

    manager.stop()
  })

  it('stops reconnecting and marks offline on fatal 401 error', () => {
    let sourceOnError: (err: unknown) => void = () => {}

    const mockFactory: EventSourceFactory = vi.fn(() => {
      const source: EventSourceLike = {
        onopen: null,
        onerror: null,
        addEventListener: vi.fn(),
        close: vi.fn(),
      }
      setTimeout(() => {
        if (source.onerror) sourceOnError = source.onerror
      }, 0)
      return source
    })

    const onFatalError = vi.fn()
    const manager = new NotificationStreamManager({
      url: '/v1/notifications/stream',
      getHeaders: () => ({ Authorization: 'Bearer expired' }),
      factory: mockFactory,
      events: ['connected'],
      onEvent: vi.fn(),
      onFatalError,
    })

    manager.start()
    vi.runAllTimers()

    sourceOnError?.(new SseHttpError(401, 'Unauthorized'))

    expect(manager.currentStatus).toBe('offline')
    expect(onFatalError).toHaveBeenCalledOnce()
  })
})
