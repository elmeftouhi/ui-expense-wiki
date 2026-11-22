import { ApiClientError } from '@/api/client'
import type { DuplicateExpenseDetails, DuplicateWarningResponse } from '../types'

export const DEFAULT_CONFIRMATION_FIELD = 'confirmDuplicate'

export class DuplicateExpenseWarningError extends Error {
  public readonly warning: DuplicateWarningResponse

  constructor(warning: DuplicateWarningResponse) {
    super(warning.message || 'An expense with the same details already exists.')
    this.name = 'DuplicateExpenseWarningError'
    this.warning = warning
  }
}

export function isDuplicateExpenseWarning(error: unknown): error is DuplicateExpenseWarningError {
  return error instanceof DuplicateExpenseWarningError
}

export function isDuplicateText(text: unknown): boolean {
  if (typeof text !== 'string') return false
  const lower = text.toLowerCase()
  return (
    lower.includes('already exist') ||
    lower.includes('already_exist') ||
    lower.includes('duplicate') ||
    lower.includes('possible match') ||
    lower.includes('similar expense') ||
    lower.includes('already recorded') ||
    lower.includes('already been recorded') ||
    lower.includes('already been created') ||
    lower.includes('conflict')
  )
}

function findDuplicateText(candidate: unknown): string | null {
  if (typeof candidate === 'string') {
    return isDuplicateText(candidate) ? candidate : null
  }
  if (Array.isArray(candidate)) {
    for (const item of candidate) {
      const found = findDuplicateText(item)
      if (found) return found
    }
    return null
  }
  if (candidate && typeof candidate === 'object') {
    const record = candidate as Record<string, unknown>
    for (const key of ['message', 'error', 'details', 'title', 'code', 'warning']) {
      const val = record[key]
      if (typeof val === 'string' && isDuplicateText(val)) {
        return val
      }
    }
    if (record.errors) {
      const foundInErrors = findDuplicateText(record.errors)
      if (foundInErrors) return foundInErrors
    }
    if (record.details) {
      const foundInDetails = findDuplicateText(record.details)
      if (foundInDetails) return foundInDetails
    }
  }
  return null
}

export function extractMatchingExpense(candidate: unknown): DuplicateExpenseDetails | null {
  if (!candidate || typeof candidate !== 'object') return null
  const obj = candidate as Record<string, unknown>

  const nested =
    obj.duplicateExpense ??
    obj.existingExpense ??
    obj.matchingExpense ??
    obj.duplicate ??
    obj.match ??
    obj.existing ??
    (obj.details && typeof obj.details === 'object' && !Array.isArray(obj.details) ? obj.details : null)

  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    return nested as DuplicateExpenseDetails
  }

  // If the object itself is passed (e.g. from an error body representing the existing expense)
  if (
    ('amount' in obj || 'categoryId' in obj || 'categoryName' in obj) &&
    ('dueDate' in obj || 'paidDate' in obj || 'date' in obj)
  ) {
    return obj as DuplicateExpenseDetails
  }

  return null
}

export function parseDuplicateWarning(errorOrResponse: unknown): DuplicateWarningResponse | null {
  if (!errorOrResponse) return null

  if (errorOrResponse instanceof DuplicateExpenseWarningError) {
    return errorOrResponse.warning
  }

  if (errorOrResponse instanceof ApiClientError) {
    return parseFromDataOrStatus(errorOrResponse.data, errorOrResponse.status, errorOrResponse.message)
  }

  if (errorOrResponse instanceof Error) {
    if (isDuplicateText(errorOrResponse.message)) {
      return {
        isDuplicate: true,
        message: errorOrResponse.message,
        matchingExpense: {},
        confirmationField: DEFAULT_CONFIRMATION_FIELD,
      }
    }
  }

  if (typeof errorOrResponse === 'object') {
    const candidate = errorOrResponse as Record<string, unknown>
    if ('data' in candidate && typeof candidate.status === 'number') {
      const msg = typeof candidate.message === 'string' ? candidate.message : undefined
      return parseFromDataOrStatus(candidate.data, candidate.status as number, msg)
    }
    return parseFromDataOrStatus(candidate, 200)
  }

  return null
}

function parseFromDataOrStatus(data: unknown, status?: number, fallbackMessage?: string): DuplicateWarningResponse | null {
  const duplicateTextInFallback = fallbackMessage && isDuplicateText(fallbackMessage) ? fallbackMessage : null
  const duplicateTextInData = findDuplicateText(data)
  const isConflictStatus = status === 409

  if (!data || typeof data !== 'object') {
    if (isConflictStatus || duplicateTextInData || duplicateTextInFallback) {
      return {
        isDuplicate: true,
        message:
          duplicateTextInData ||
          duplicateTextInFallback ||
          (typeof data === 'string' && data.trim() ? data.trim() : 'An expense with the same details already exists.'),
        matchingExpense: {},
        confirmationField: DEFAULT_CONFIRMATION_FIELD,
      }
    }
    return null
  }

  const body = data as Record<string, unknown>

  const hasNestedDuplicate =
    body.duplicateExpense !== undefined ||
    body.existingExpense !== undefined ||
    body.matchingExpense !== undefined ||
    body.duplicate !== undefined ||
    body.match !== undefined ||
    body.existing !== undefined

  const isDuplicateFlag =
    body.isDuplicate === true ||
    body.isDuplicateWarning === true ||
    body.alreadyExists === true ||
    body.hasDuplicate === true ||
    body.warning === 'DUPLICATE_EXPENSE' ||
    body.warning === 'DUPLICATE_WARNING' ||
    body.code === 'DUPLICATE_EXPENSE' ||
    body.code === 'DUPLICATE_WARNING' ||
    body.code === 'POSSIBLE_DUPLICATE' ||
    body.code === 'ALREADY_EXISTS' ||
    body.error === 'DuplicateExpenseWarning' ||
    body.error === 'DUPLICATE_EXPENSE' ||
    body.error === 'Conflict' ||
    body.type === 'DUPLICATE_WARNING' ||
    body.status === 'DUPLICATE_DETECTED'

  const hasDuplicateText = Boolean(duplicateTextInData || duplicateTextInFallback)
  const isDuplicate = isDuplicateFlag || hasNestedDuplicate || isConflictStatus || hasDuplicateText

  if (!isDuplicate) {
    return null
  }

  const match = extractMatchingExpense(body)

  const confirmationField =
    typeof body.confirmationField === 'string' && body.confirmationField.trim()
      ? body.confirmationField.trim()
      : typeof body.confirmationKey === 'string' && body.confirmationKey.trim()
      ? body.confirmationKey.trim()
      : DEFAULT_CONFIRMATION_FIELD

  const message =
    typeof body.message === 'string' && body.message.trim()
      ? body.message.trim()
      : typeof body.warningMessage === 'string' && body.warningMessage.trim()
      ? body.warningMessage.trim()
      : duplicateTextInData || duplicateTextInFallback || 'An expense with the same details already exists.'

  return {
    isDuplicate: true,
    message,
    matchingExpense: match ?? {},
    confirmationField,
  }
}
