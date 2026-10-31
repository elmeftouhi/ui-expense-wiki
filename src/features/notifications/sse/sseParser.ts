/**
 * Incremental `text/event-stream` parser (WHATWG HTML §9.2.6).
 * Accepts arbitrary chunk boundaries, including CRLF split across chunks.
 */
export interface ParsedSseEvent {
  event: string
  data: string
  id?: string
  retry?: number
}

export interface SseParser {
  push(chunk: string): void
  reset(): void
}

export function createSseParser(onEvent: (event: ParsedSseEvent) => void): SseParser {
  let buffer = ''
  let dataLines: string[] = []
  let eventName = ''
  let lastEventId: string | undefined
  let retry: number | undefined
  let isFirstChunk = true

  const dispatch = () => {
    if (dataLines.length === 0 && !eventName) return
    onEvent({
      event: eventName || 'message',
      data: dataLines.join('\n'),
      id: lastEventId,
      retry,
    })
    dataLines = []
    eventName = ''
    retry = undefined
  }

  const processLine = (line: string) => {
    if (line === '') {
      dispatch()
      return
    }
    if (line.startsWith(':')) return // comment / heartbeat

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    let value = colon === -1 ? '' : line.slice(colon + 1)
    if (value.startsWith(' ')) value = value.slice(1)

    switch (field) {
      case 'event':
        eventName = value
        break
      case 'data':
        dataLines.push(value)
        break
      case 'id':
        if (!value.includes('\u0000')) lastEventId = value
        break
      case 'retry':
        if (/^\d+$/.test(value)) retry = Number(value)
        break
      default:
        break
    }
  }

  return {
    push(chunk: string) {
      if (isFirstChunk) {
        isFirstChunk = false
        if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1)
      }
      buffer += chunk
      let start = 0
      for (let i = 0; i < buffer.length; i++) {
        const char = buffer[i]
        if (char !== '\n' && char !== '\r') continue
        // A trailing CR may be the first half of a CRLF in the next chunk.
        if (char === '\r' && i === buffer.length - 1) break
        processLine(buffer.slice(start, i))
        if (char === '\r' && buffer[i + 1] === '\n') i++
        start = i + 1
      }
      buffer = buffer.slice(start)
    },
    reset() {
      buffer = ''
      dataLines = []
      eventName = ''
      retry = undefined
    },
  }
}

