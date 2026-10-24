import { ApiClientError } from '@/api/client'

/**
 * Extracts a human-friendly message from any thrown value.
 * Understands Spring Boot error bodies ({ message }, { error }, { details | errors }) and
 * validation maps returned by the backend.
 */
export function getApiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiClientError) {
    const data = error.data
    if (typeof data === 'string' && data.trim()) return data.trim()

    if (data && typeof data === 'object') {
      const body = data as Record<string, unknown>
      const fieldErrors = body.details ?? body.errors
      if (fieldErrors && typeof fieldErrors === 'object' && !Array.isArray(fieldErrors)) {
        const messages = Object.entries(fieldErrors as Record<string, unknown>).map(([field, msg]) =>
          `${field}: ${Array.isArray(msg) ? msg.join(', ') : String(msg)}`,
        )
        if (messages.length > 0) return messages.join(' • ')
      }
      if (typeof body.message === 'string' && body.message.trim()) return body.message
      if (typeof body.error === 'string' && body.error.trim()) return body.error
    }

    if (error.status === 0) return 'Unable to reach the server. Check your connection.'
    if (error.status === 403) return 'You do not have permission to perform this action.'
    if (error.status === 404) return 'The requested resource was not found.'
    return error.message || fallback
  }

  if (error instanceof Error && error.message) return error.message
  return fallback
}
