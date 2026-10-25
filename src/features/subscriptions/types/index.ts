import type { ExpenseStatus } from '@/features/expenses/types'

export const SUBSCRIPTION_FREQUENCIES = [
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
  'YEARLY',
  'CUSTOM',
] as const

export type SubscriptionFrequency = (typeof SUBSCRIPTION_FREQUENCIES)[number]
export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'STOPPED' | 'ENDED'
export type SubscriptionSortField = 'nextBillingDate' | 'name'
export type SortDirection = 'asc' | 'desc'

export interface Subscription {
  id: number
  name: string
  description?: string | null
  categoryId: number
  categoryName: string
  ownerUserId: number
  amount: number
  currency: string
  frequency: SubscriptionFrequency
  customIntervalDays?: number | null
  nextBillingDate: string
  overdue: boolean
  daysLeftBeforeDueDate: number | null
  endDate?: string | null
  status: SubscriptionStatus
  reminderLeadDays: number
  paymentMethod?: string | null
  paymentMethodId?: number | null
  paymentMethodName?: string | null
  notes?: string | null
  tenantId: number
  createdAt: string
  updatedAt: string
  version: number
}

export interface SubscriptionWriteRequest {
  name: string
  description?: string
  categoryId: number
  amount: number
  currency?: string
  frequency: SubscriptionFrequency
  customIntervalDays?: number
  nextBillingDate: string
  endDate?: string
  reminderLeadDays?: number
  paymentMethodId?: number | null
  notes?: string
}

export interface SubscriptionRecurringCost {
  currency: string
  monthly: number
  yearly: number
}

export interface SubscriptionFilters {
  paymentMethodId?: number
  paymentMethodIds?: number[]
  search?: string
  status?: SubscriptionStatus
  statuses?: SubscriptionStatus[]
  categoryId?: number
  categoryIds?: number[]
  frequency?: SubscriptionFrequency
  nextBillingFrom?: string
  nextBillingTo?: string
  page: number
  size: number
  sort: SubscriptionSortField
  direction: SortDirection
}

export type SubscriptionCostFilters = Omit<SubscriptionFilters, 'page' | 'size' | 'sort' | 'direction'>

export interface SubscriptionPage {
  content: Subscription[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface SubscriptionPayment {
  id: number
  subscriptionId: number
  scheduledBillingDate: string
  expenseId: number
  expenseAmount: number
  expenseCurrency: string
  expenseStatus: ExpenseStatus
  expenseDueDate: string
  expensePaidDate?: string | null
  createdAt: string
}

export interface SubscriptionPaymentPage {
  content: SubscriptionPayment[]
  page: number
  size: number
  totalElements: number
  totalPages: number
}

export interface GeneratePaymentResult {
  generated: boolean
  alreadyExists: boolean
  message?: string | null
  paymentId: number
  expenseId: number
  scheduledBillingDate: string
}

export interface SubscriptionPageParams {
  page: number
  size: number
  sort: 'scheduledBillingDate' | 'createdAt'
  direction: SortDirection
}

export interface SubscriptionResumeRequest {
  nextBillingDate: string
}
