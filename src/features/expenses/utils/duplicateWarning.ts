import { ApiClientError } from '@/api/client'
import type { DuplicateExpenseDetails, DuplicateWarningResponse } from '../types'

export const DEFAULT_CONFIRMATION_FIELD = 'confirmDuplicate'

export class DuplicateExpenseWarningError extends Error {
  public readonly warning: DuplicateWarningResponse

  constructor(warning: DuplicateWarningResponse) {
    super(warning.message || 'A matching expense already exists.')
    this.name = 'DuplicateExpenseWarningError'
    this.warning = warning
  }
}

export function isDuplicateExpenseWarning(error: unknown): error is DuplicateExpenseWarningError {
  return error instanceof DuplicateExpenseWarningError
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
    return parseFromDataOrStatus(errorOrResponse.data, errorOrResponse.status)
  }

  if (typeof errorOrResponse === 'object') {
    const candidate = errorOrResponse as Record<string, unknown>
    if ('data' in candidate && typeof candidate.status === 'number') {
      return parseFromDataOrStatus(candidate.data, candidate.status as number)
    }
    return parseFromDataOrStatus(candidate, 200)
  }

  return null
}

function parseFromDataOrStatus(data: unknown, status?: number): DuplicateWarningResponse | null {
  if (!data || typeof data !== 'object') {
    if (status === 409) {
      return {
        isDuplicate: true,
        message: 'A matching expense already exists.',
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
    body.warning === 'DUPLICATE_EXPENSE' ||
    body.warning === 'DUPLICATE_WARNING' ||
    body.code === 'DUPLICATE_EXPENSE' ||
    body.code === 'DUPLICATE_WARNING' ||
    body.code === 'POSSIBLE_DUPLICATE' ||
    body.error === 'DuplicateExpenseWarning' ||
    body.error === 'DUPLICATE_EXPENSE' ||
    body.type === 'DUPLICATE_WARNING' ||
    body.status === 'DUPLICATE_DETECTED'

  const isDuplicate = isDuplicateFlag || hasNestedDuplicate || status === 409

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
      : 'A possible duplicate expense already exists.'

  return {
    isDuplicate: true,
    message,
    matchingExpense: match ?? {},
    confirmationField,
  }
}
