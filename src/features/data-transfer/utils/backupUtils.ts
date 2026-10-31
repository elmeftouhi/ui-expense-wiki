import { ApiClientError } from '@/api/client'
import { EXPECTED_BACKUP_FORMAT_VERSION } from '../schemas/dataTransferSchema'
import type { ImportedDataCounts, UserDataBackupSnapshot } from '../types'

export const IMPORT_COUNT_ROWS: ReadonlyArray<{
  key: keyof ImportedDataCounts
  label: string
}> = [
  { key: 'exercices', label: 'Exercices' },
  { key: 'categories', label: 'Categories' },
  { key: 'paymentMethods', label: 'Payment methods' },
  { key: 'budgets', label: 'Budgets' },
  { key: 'budgetPeriodInstances', label: 'Budget period instances' },
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'subscriptionPayments', label: 'Subscription payments' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'activityLogs', label: 'Activity logs' },
]

export function sanitizeTenantNameForFilename(tenantName: string): string {
  const sanitized = tenantName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return sanitized || 'workspace'
}

export function formatBackupTimestamp(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  const yyyy = date.getFullYear()
  const MM = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const HH = pad(date.getHours())
  const mm = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${yyyy}${MM}${dd}-${HH}${mm}${ss}`
}

export function buildBackupFilename(tenantName: string, date: Date = new Date()): string {
  return `expense-backup-${sanitizeTenantNameForFilename(tenantName)}-${formatBackupTimestamp(date)}.json`
}

export function downloadBackupJson(snapshot: UserDataBackupSnapshot, filename: string): void {
  const serialized = JSON.stringify(snapshot, null, 2)
  const blob = new Blob([serialized], { type: 'application/json;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)

  try {
    link.click()
  } finally {
    document.body.removeChild(link)
    // Defer revocation so the browser has initiated the download stream
    setTimeout(() => {
      URL.revokeObjectURL(objectUrl)
    }, 0)
  }
}

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/**
 * Reads a File asynchronously without blocking the UI thread.
 * Yields a frame before parsing when reading large files so loading indicators paint smoothly.
 */
export async function readBackupFileAsync(file: File): Promise<string> {
  let content: string
  if (typeof file.text === 'function') {
    content = await file.text()
  } else {
    content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
      reader.onerror = () => reject(new Error('Unable to read the selected file.'))
      reader.readAsText(file)
    })
  }

  if (content.length > 256_000) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
  }

  return content
}

export interface BackupInspectionSuccess {
  ok: true
  snapshot: UserDataBackupSnapshot
  formatVersion: string | null
  formatWarning: string | null
  sourceTenantName: string | null
  exportedAt: string | null
  estimatedRecords: number
}

export interface BackupInspectionFailure {
  ok: false
  error: string
}

export type BackupInspectionResult = BackupInspectionSuccess | BackupInspectionFailure

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function inspectBackupJson(rawText: string): BackupInspectionResult {
  const trimmed = rawText.trim()
  if (!trimmed) {
    return {
      ok: false,
      error: 'Provide a backup JSON file or paste backup JSON.',
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return {
      ok: false,
      error: 'Invalid JSON format. Check the backup syntax and try again.',
    }
  }

  if (!isPlainObject(parsed)) {
    return {
      ok: false,
      error: 'Invalid backup structure. The root value must be a JSON object.',
    }
  }

  const snapshot = parsed as UserDataBackupSnapshot
  const metadata = isPlainObject(snapshot.metadata) ? snapshot.metadata : undefined
  const rawVersion = metadata?.formatVersion
  const formatVersion =
    rawVersion !== undefined && rawVersion !== null && String(rawVersion).trim() !== ''
      ? String(rawVersion).trim()
      : null

  let formatWarning: string | null = null
  if (formatVersion === null) {
    formatWarning = `Backup metadata.formatVersion is missing (expected "${EXPECTED_BACKUP_FORMAT_VERSION}"). Import may fail if the snapshot format is incompatible.`
  } else if (formatVersion !== EXPECTED_BACKUP_FORMAT_VERSION) {
    formatWarning = `Backup formatVersion is "${formatVersion}" (expected "${EXPECTED_BACKUP_FORMAT_VERSION}"). Import may not be compatible with this version.`
  }

  const sourceTenantName =
    typeof metadata?.tenantName === 'string' && metadata.tenantName.trim()
      ? metadata.tenantName.trim()
      : null
  const exportedAt =
    typeof metadata?.exportedAt === 'string' && metadata.exportedAt.trim()
      ? metadata.exportedAt.trim()
      : null

  let estimatedRecords = 0
  for (const { key } of IMPORT_COUNT_ROWS) {
    const collection = snapshot[key]
    if (Array.isArray(collection)) {
      estimatedRecords += collection.length
    }
  }

  return {
    ok: true,
    snapshot,
    formatVersion,
    formatWarning,
    sourceTenantName,
    exportedAt,
    estimatedRecords,
  }
}

function extractServerDetail(error: ApiClientError): string | null {
  const { data } = error
  if (typeof data === 'string' && data.trim()) {
    return data.trim()
  }
  if (isPlainObject(data)) {
    const fieldErrors = data.details ?? data.errors
    if (isPlainObject(fieldErrors)) {
      const messages = Object.entries(fieldErrors).map(
        ([field, msg]) => `${field}: ${Array.isArray(msg) ? msg.join(', ') : String(msg)}`,
      )
      if (messages.length > 0) return messages.join(' • ')
    }
    if (typeof data.message === 'string' && data.message.trim()) return data.message.trim()
    if (typeof data.error === 'string' && data.error.trim()) {
      // Avoid returning raw HTTP reason phrases like "Conflict" or "Forbidden" alone
      const rawError = data.error.trim()
      if (!/^(bad request|unauthorized|forbidden|conflict|internal server error)$/i.test(rawError)) {
        return rawError
      }
    }
  }
  return null
}

export function getExportErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const detail = extractServerDetail(error)
    if (error.status === 401) {
      return 'Authentication required. Sign in again to export workspace data.'
    }
    if (error.status === 403) {
      return detail || 'Tenant administrator access is required to export this workspace.'
    }
    if (error.status === 0) {
      return 'Unable to reach the server. Check your connection and try again.'
    }
    if (detail) return detail
    return 'Unable to export workspace data. Please try again.'
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Unable to export workspace data. Please try again.'
}

export function getImportErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    const detail = extractServerDetail(error)
    if (error.status === 400) {
      return detail || 'Invalid backup payload or workspace name. Check your input and try again.'
    }
    if (error.status === 401) {
      return 'Authentication required. Your session may have expired—sign in again and retry.'
    }
    if (error.status === 403) {
      return detail || 'You do not have permission to import workspace data.'
    }
    if (error.status === 409) {
      if (detail && /tenant name already exists|workspace.*already exists/i.test(detail)) {
        return detail
      }
      return detail
        ? `${detail} — A workspace with this tenant name already exists.`
        : 'A workspace with this tenant name already exists. Choose a different workspace name.'
    }
    if (error.status === 0) {
      return 'Unable to reach the server. Check your connection and try again.'
    }
    if (detail) return detail
    return 'Unable to import workspace backup. Please try again.'
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return 'Unable to import workspace backup. Please try again.'
}

