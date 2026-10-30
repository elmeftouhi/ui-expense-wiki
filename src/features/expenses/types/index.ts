export type ExpenseType = 'NORMAL' | 'SUBSCRIPTION'
export type ExpenseStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELLED'
export type ExpenseSortField = 'dueDate' | 'description' | 'amount' | 'createdAt'
export type SortDirection = 'asc' | 'desc'

export interface ExpenseResponse {
  id: number
  categoryId: number
  categoryName: string
  userId: number
  description: string
  amount: number
  currency: string
  type: ExpenseType
  status: ExpenseStatus
  dueDate: string
  paidDate?: string | null
  paymentMethod?: string | null
  paymentMethodId?: number | null
  paymentMethodName?: string | null
  notes?: string | null
  hasSubscription: boolean
  subscriptionPaymentId?: number | null
  tenantId: number
  createdAt: string
  updatedAt: string
}

export interface ExpenseUpsertRequest {
  categoryId: number
  description: string
  amount: number
  dueDate: string
  paidDate?: string | null
  type?: ExpenseType
  paymentMethodId?: number | null
  notes?: string | null
}

export interface ExpenseStatusChangeRequest {
  status: ExpenseStatus
  paidDate?: string | null
}

export interface ExpensePageResponse {
  content: ExpenseResponse[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  filteredTotalAmount?: number
  recordsCount?: number
}

export interface ExpenseCategoryStatistic {
  categoryId: number
  categoryName: string
  total: number
  parentTotal: number | null
  subCategories: ExpenseCategoryStatistic[]
}

export interface ExpenseStatisticsResponse {
  totalExpenses: number
  totalPaid: number
  totalPending: number
  totalOverdue: number
  overdueCount: number
  pendingCount: number
  byCategory: ExpenseCategoryStatistic[]
}

export interface ExpenseListFilters {
  search?: string
  status?: Extract<ExpenseStatus, 'PAID' | 'PENDING'>
  paymentMethodId?: number
  year?: number
  month?: number
  categoryIds?: number[]
  type?: ExpenseType
  page: number
  size: number
  sort: ExpenseSortField
  direction: SortDirection
}

export interface ExpenseStatisticsFilters {
  startDate: string
  endDate: string
}
