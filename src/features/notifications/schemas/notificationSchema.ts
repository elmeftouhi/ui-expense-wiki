import { z } from 'zod'
import type { Notification, NotificationPage } from '../types'

const idSchema = z.union([z.number(), z.string().min(1)])
const nullableId = idSchema.nullish().transform((value) => value ?? null)
const nullableString = z.string().nullish().transform((value) => value ?? null)

function normalizeData(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined || raw === '') return null
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : { value: parsed }
    } catch {
      return { value: raw }
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>
  return { value: raw }
}

export const notificationSchema = z.object({
  id: idSchema,
  userId: nullableId,
  type: z.string().nullish().transform((value) => value || 'GENERAL'),
  status: z.string().min(1),
  title: z.string().nullish().transform((value) => value ?? ''),
  message: z.string().nullish().transform((value) => value ?? ''),
  subjectType: nullableString,
  subjectId: nullableId,
  data: z.unknown().transform(normalizeData),
  tenantId: nullableId,
  createdAt: z.string().min(1),
  readAt: nullableString,
  archivedAt: nullableString,
})

const pageEnvelopeSchema = z.object({
  items: z.array(z.unknown()),
  page: z.number().int().nonnegative(),
  size: z.number().int().nonnegative(),
  totalElements: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNext: z.boolean(),
})

/** Returns a typed notification or `null` when the payload is not a notification. */
export function parseNotification(raw: unknown): Notification | null {
  let candidate = raw
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return null
    }
  }
  // Some emitters wrap the entity: { notification: {...} }
  if (
    candidate &&
    typeof candidate === 'object' &&
    'notification' in candidate &&
    !('id' in candidate)
  ) {
    candidate = (candidate as { notification: unknown }).notification
  }
  const result = notificationSchema.safeParse(candidate)
  return result.success ? (result.data as Notification) : null
}

/** Validates the page envelope; individual malformed items are dropped rather than failing the page. */
export function parseNotificationPage(raw: unknown): NotificationPage {
  const result = pageEnvelopeSchema.safeParse(raw)
  if (!result.success) {
    throw new Error('The server returned an invalid notifications page.')
  }
  const items: Notification[] = []
  for (const item of result.data.items) {
    const parsed = parseNotification(item)
    if (parsed) items.push(parsed)
  }
  return { ...result.data, items }
}

export function parseUnreadCount(raw: unknown): number {
  const value =
    raw && typeof raw === 'object' && 'count' in raw ? (raw as { count: unknown }).count : raw
  const numeric = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  if (typeof numeric !== 'number' || !Number.isFinite(numeric) || numeric < 0) {
    throw new Error('The server returned an invalid unread notification count.')
  }
  return Math.floor(numeric)
}

