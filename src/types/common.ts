/**
 * Common shared models and pagination structures.
 */

export interface Pageable {
  pageNumber: number
  pageSize: number
  totalElements?: number
  totalPages?: number
}

export interface PaginatedResponse<T> {
  content: T[]
  pageable: Pageable
  totalElements: number
  totalPages: number
  last: boolean
  first: boolean
  empty: boolean
}

export interface ApiErrorResponse {
  message: string
  code?: string
  status?: number
  timestamp?: string
  details?: Record<string, string[]>
}

export type SortDirection = 'asc' | 'desc'

export interface SortCriteria {
  property: string
  direction: SortDirection
}
