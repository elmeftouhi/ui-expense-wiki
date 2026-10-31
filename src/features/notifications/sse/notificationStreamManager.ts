import type { StreamStatus } from '../types'
import { SseHttpError, type EventSourceFactory, type EventSourceLike } from './fetchEventSource'

export interface BackoffOptions {
  initialDelayMs?: number
  maxDelayMs?: number
  factor?: number
}

/** 1s, 2s, 4s, 8s, 16s, 30s, 30s, ... with the default options. */
export function computeBackoffDelay(attempt: number, options: BackoffOptions = {}): number {
  const { initialDelayMs = 1000, maxDelayMs = 30_000, factor = 2 } = options
  return Math.min(maxDelayMs, initialDelayMs * factor ** Math.max(0, attempt))
}

/** 401/403 will not succeed by retrying with the same credentials. */
export function isFatalStreamError(error: unknown): boolean {
  return error instanceof SseHttpError && (error.status === 401 || error.status === 403)
}

export interface NotificationStreamManagerOptions {
  url: string
  /** Called on every (re)connect so a refreshed JWT is always used. */
  getHeaders: () => Record<string, string>
  factory: EventSourceFactory
  events: readonly string[]
  onEvent: (type: string, payload: unknown) => void
  onStatusChange?: (status: StreamStatus) => void
  /** Fires after a `connected` event that follows a previous successful connection. */
  onReconnected?: () => void
  onFatalError?: (error: unknown) => void
  backoff?: BackoffOptions
}

function parsePayload(data: string): unknown {
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

/**
 * Owns a single SSE connection: connects, dispatches named events, and
 * reconnects with exponential backoff. A `generation` counter makes callbacks
 * from superseded connections inert, so late events never leak across reconnects.
 */
export class NotificationStreamManager {
  private readonly options: NotificationStreamManagerOptions
  private source: EventSourceLike | null = null
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private attempt = 0
  private generation = 0
  private stopped = true
  private hasConnectedOnce = false
  private lastEventId: string | undefined
  private status: StreamStatus = 'idle'

  constructor(options: NotificationStreamManagerOptions) {
    this.options = options
  }

  get currentStatus(): StreamStatus {
    return this.status
  }

  start(): void {
    if (!this.stopped) return
    this.stopped = false
    this.attempt = 0
    this.connect()
  }

  stop(): void {
    this.stopped = true
    this.generation++
    this.clearRetry()
    this.closeSource()
    this.setStatus('idle')
  }

  /** Skip the remaining backoff (e.g. when the browser comes back online). */
  reconnectNow(): void {
    if (this.stopped || this.status === 'online' || this.status === 'connecting') return
    this.clearRetry()
    this.closeSource()
    this.connect()
  }

  private connect() {
    const generation = ++this.generation
    this.setStatus(this.hasConnectedOnce || this.attempt > 0 ? 'reconnecting' : 'connecting')

    const headers = { ...this.options.getHeaders() }
    if (this.lastEventId) headers['Last-Event-ID'] = this.lastEventId

    let source: EventSourceLike
    try {
      source = this.options.factory(this.options.url, { headers })
    } catch (error) {
      this.handleError(generation, error)
      return
    }
    this.source = source

    for (const type of this.options.events) {
      source.addEventListener(type, (event) => {
        if (generation !== this.generation || this.stopped) return
        if (event.lastEventId) this.lastEventId = event.lastEventId
        this.handleMessage(type, parsePayload(event.data))
      })
    }
    source.onerror = (error) => this.handleError(generation, error)
  }

  private handleMessage(type: string, payload: unknown) {
    if (type === 'connected') {
      const isReconnect = this.hasConnectedOnce
      this.hasConnectedOnce = true
      this.attempt = 0
      this.setStatus('online')
      this.options.onEvent(type, payload)
      if (isReconnect) this.options.onReconnected?.()
      return
    }
    this.options.onEvent(type, payload)
  }

  private handleError(generation: number, error: unknown) {
    if (generation !== this.generation || this.stopped) return
    this.closeSource()

    if (isFatalStreamError(error)) {
      this.stopped = true
      this.setStatus('offline')
      this.options.onFatalError?.(error)
      return
    }

    const delay = computeBackoffDelay(this.attempt, this.options.backoff)
    this.attempt++
    this.setStatus('reconnecting')
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      if (!this.stopped) this.connect()
    }, delay)
  }

  private closeSource() {
    const source = this.source
    this.source = null
    if (!source) return
    source.onerror = null
    source.onopen = null
    try {
      source.close()
    } catch {
      // ignore
    }
  }

  private clearRetry() {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  private setStatus(status: StreamStatus) {
    if (this.status === status) return
    this.status = status
    this.options.onStatusChange?.(status)
  }
}

