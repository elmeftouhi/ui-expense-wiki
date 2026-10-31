import { createSseParser } from './sseParser'

/**
 * Minimal EventSource-compatible surface used by the stream manager.
 * Native `EventSource` cannot send `Authorization` / `X-Tenant-Id` headers,
 * so production uses {@link FetchEventSource}; tests inject a mock.
 */
export interface StreamMessageEvent {
  data: string
  lastEventId?: string
}

export interface EventSourceLike {
  onopen: (() => void) | null
  onerror: ((error: unknown) => void) | null
  addEventListener(type: string, listener: (event: StreamMessageEvent) => void): void
  close(): void
}

export interface EventSourceInit {
  headers: Record<string, string>
}

export type EventSourceFactory = (url: string, init: EventSourceInit) => EventSourceLike

/** HTTP-level failure of the stream request; `status` drives fatal vs. retryable handling. */
export class SseHttpError extends Error {
  readonly status: number

  constructor(status: number, message?: string) {
    super(message ?? `Notification stream request failed with status ${status}`)
    this.name = 'SseHttpError'
    this.status = status
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError'
}

/**
 * EventSource replacement built on `fetch` + `ReadableStream` so custom headers can be sent.
 * It does not auto-reconnect: `onerror` fires exactly once and the manager owns retry policy.
 */
export class FetchEventSource implements EventSourceLike {
  onopen: (() => void) | null = null
  onerror: ((error: unknown) => void) | null = null

  private readonly listeners = new Map<string, Set<(event: StreamMessageEvent) => void>>()
  private readonly controller = new AbortController()
  private closed = false

  constructor(url: string, init: EventSourceInit, fetchImpl: typeof fetch = fetch) {
    void this.run(url, init, fetchImpl)
  }

  addEventListener(type: string, listener: (event: StreamMessageEvent) => void): void {
    const bucket = this.listeners.get(type) ?? new Set()
    bucket.add(listener)
    this.listeners.set(type, bucket)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.controller.abort()
  }

  private fail(error: unknown) {
    if (this.closed) return
    this.closed = true
    this.controller.abort()
    this.onerror?.(error)
  }

  private async run(url: string, init: EventSourceInit, fetchImpl: typeof fetch) {
    try {
      const response = await fetchImpl(url, {
        method: 'GET',
        headers: { Accept: 'text/event-stream', 'Cache-Control': 'no-cache', ...init.headers },
        cache: 'no-store',
        signal: this.controller.signal,
      })
      if (this.closed) return
      if (!response.ok) throw new SseHttpError(response.status)

      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('text/event-stream')) {
        throw new SseHttpError(response.status, `Unexpected stream content type "${contentType}"`)
      }
      if (!response.body) throw new Error('Notification stream has no body')

      this.onopen?.()

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      const parser = createSseParser((event) => {
        this.listeners.get(event.event)?.forEach((listener) =>
          listener({ data: event.data, lastEventId: event.id }),
        )
      })

      while (!this.closed) {
        const { done, value } = await reader.read()
        if (done) break
        parser.push(decoder.decode(value, { stream: true }))
      }
      if (!this.closed) this.fail(new Error('Notification stream closed by server'))
    } catch (error) {
      if (this.closed || isAbortError(error)) return
      this.fail(error)
    }
  }
}

export const createFetchEventSource: EventSourceFactory = (url, init) => new FetchEventSource(url, init)

