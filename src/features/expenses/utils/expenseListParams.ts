import type { ExpenseListFilters, ExpenseSortField, ExpenseStatus, ExpenseType, SortDirection } from '../types'

export const VALID_PAGE_SIZES = [10, 25, 50, 100] as const
const VALID_SORTS: ExpenseSortField[] = ['dueDate', 'description', 'amount', 'createdAt']
const VALID_TYPES: ExpenseType[] = ['NORMAL', 'SUBSCRIPTION']
const VALID_STATUSES: Array<Extract<ExpenseStatus, 'PAID' | 'PENDING'>> = ['PAID', 'PENDING']

export function defaultExpenseFilters(now = new Date()): ExpenseListFilters {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    page: 0,
    size: 25,
    sort: 'dueDate',
    direction: 'desc',
  }
}

export function isDefaultPeriod(
  filters: Pick<ExpenseListFilters, 'year' | 'month'>,
  now = new Date(),
): boolean {
  return filters.year === now.getFullYear() && filters.month === now.getMonth() + 1
}

export function hasNonDefaultFilters(
  filters: ExpenseListFilters,
  now = new Date(),
): boolean {
  return Boolean(
    !isDefaultPeriod(filters, now) ||
      filters.search?.trim() ||
      filters.categoryIds?.length ||
      filters.status ||
      filters.type ||
      filters.paymentMethodId !== undefined,
  )
}

export function countActiveOptionalFilters(
  filters: ExpenseListFilters,
  now = new Date(),
): number {
  return [
    !isDefaultPeriod(filters, now),
    Boolean(filters.type),
    Boolean(filters.status),
    filters.paymentMethodId !== undefined,
    filters.size !== 25,
  ].filter(Boolean).length
}

export function shiftYearMonth(
  year: number,
  month: number,
  deltaMonths: number,
): { year: number; month: number } {
  const zeroIndexed = year * 12 + (month - 1) + deltaMonths
  const nextYear = Math.floor(zeroIndexed / 12)
  const nextMonth = ((zeroIndexed % 12) + 12) % 12 + 1
  return { year: nextYear, month: nextMonth }
}

export function parseExpenseSearchParams(
  params: URLSearchParams,
  now = new Date(),
): ExpenseListFilters {
  const defaults = defaultExpenseFilters(now)
  const period = params.get('period')

  let year: number | undefined = defaults.year
  let month: number | undefined = defaults.month

  if (period === 'all') {
    year = undefined
    month = undefined
  } else if (params.has('year')) {
    const parsedYear = Number(params.get('year'))
    if (Number.isInteger(parsedYear) && parsedYear >= 1970 && parsedYear <= 2100) {
      year = parsedYear
      if (params.has('month')) {
        const parsedMonth = Number(params.get('month'))
        month = Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12 ? parsedMonth : undefined
      } else {
        month = undefined
      }
    }
  } else if (params.has('month')) {
    const parsedMonth = Number(params.get('month'))
    if (Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
      month = parsedMonth
    }
  }

  const rawSearch = params.get('search')?.trim()
  const rawStatus = params.get('status')
  const status = VALID_STATUSES.includes(rawStatus as Extract<ExpenseStatus, 'PAID' | 'PENDING'>)
    ? (rawStatus as Extract<ExpenseStatus, 'PAID' | 'PENDING'>)
    : undefined

  const rawType = params.get('type')
  const type = VALID_TYPES.includes(rawType as ExpenseType) ? (rawType as ExpenseType) : undefined

  const rawMethod = params.get('method')
  const parsedMethod = rawMethod ? Number(rawMethod) : NaN
  const paymentMethodId = Number.isSafeInteger(parsedMethod) && parsedMethod > 0 ? parsedMethod : undefined

  const rawCategories = params.get('categories')
  const categoryIds = rawCategories
    ? [...new Set(
        rawCategories
          .split(',')
          .map((part) => Number(part.trim()))
          .filter((id) => Number.isSafeInteger(id) && id > 0),
      )]
    : undefined

  const rawPage = params.get('page')
  const parsedPage = rawPage ? Number(rawPage) : NaN
  const page = Number.isInteger(parsedPage) && parsedPage >= 0 ? parsedPage : defaults.page

  const rawSize = params.get('size')
  const parsedSize = rawSize ? Number(rawSize) : NaN
  const size = VALID_PAGE_SIZES.includes(parsedSize as (typeof VALID_PAGE_SIZES)[number])
    ? parsedSize
    : defaults.size

  const rawSort = params.get('sort')
  const sort = VALID_SORTS.includes(rawSort as ExpenseSortField)
    ? (rawSort as ExpenseSortField)
    : defaults.sort

  const rawDir = params.get('dir')
  const direction: SortDirection = rawDir === 'asc' || rawDir === 'desc' ? rawDir : defaults.direction

  return {
    year,
    month,
    ...(rawSearch ? { search: rawSearch } : {}),
    ...(status ? { status } : {}),
    ...(type ? { type } : {}),
    ...(paymentMethodId !== undefined ? { paymentMethodId } : {}),
    ...(categoryIds?.length ? { categoryIds } : {}),
    page,
    size,
    sort,
    direction,
  }
}

export function buildExpenseUrlSearchParams(
  filters: ExpenseListFilters,
  now = new Date(),
): URLSearchParams {
  const params = new URLSearchParams()
  const defaults = defaultExpenseFilters(now)

  if (filters.year === undefined) {
    params.set('period', 'all')
  } else if (filters.year !== defaults.year || filters.month !== defaults.month) {
    params.set('year', String(filters.year))
    if (filters.month !== undefined) {
      params.set('month', String(filters.month))
    }
  }

  if (filters.search?.trim()) params.set('search', filters.search.trim())
  if (filters.status) params.set('status', filters.status)
  if (filters.type) params.set('type', filters.type)
  if (filters.paymentMethodId !== undefined) params.set('method', String(filters.paymentMethodId))
  if (filters.categoryIds?.length) params.set('categories', filters.categoryIds.join(','))
  if (filters.page > 0) params.set('page', String(filters.page))
  if (filters.size !== defaults.size) params.set('size', String(filters.size))
  if (filters.sort !== defaults.sort) params.set('sort', filters.sort)
  if (filters.direction !== defaults.direction) params.set('dir', filters.direction)

  return params
}

