import type { CategoryOption } from '@/features/budgets/utils/categoryOptions'
import type { TenantContextValue } from '@/features/tenants/types'
import type { Subscription, SubscriptionPayment } from '../types'

export const subscription: Subscription = {
  id: 12,
  name: 'Design tools',
  description: 'Team design software',
  categoryId: 5,
  categoryName: 'Software',
  ownerUserId: 4,
  amount: 45,
  currency: 'USD',
  frequency: 'MONTHLY',
  nextBillingDate: '2026-11-05',
  overdue: false,
  daysLeftBeforeDueDate: 13,
  endDate: null,
  status: 'ACTIVE',
  reminderLeadDays: 3,
  paymentMethod: 'Company card',
  paymentMethodId: 2,
  notes: 'Annual plan paid monthly',
  tenantId: 101,
  createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z',
  version: 0,
}

export const payment: SubscriptionPayment = {
  id: 81,
  subscriptionId: 12,
  scheduledBillingDate: '2026-10-05',
  expenseId: 902,
  expenseAmount: 45,
  expenseCurrency: 'USD',
  expenseStatus: 'PENDING',
  expenseDueDate: '2026-10-05',
  expensePaidDate: null,
  createdAt: '2026-10-05T01:00:00Z',
}

export const categoryOptions: CategoryOption[] = [
  { id: 5, name: 'Software', depth: 0, active: true },
  { id: 7, name: 'Travel', depth: 0, active: true },
]

export const tenantContext: TenantContextValue = {
  activeTenant: {
    id: 101, name: 'Example workspace', slug: 'example', currency: 'USD', locale: 'en-US',
    status: 'ACTIVE', plan: 'PRO', fiscalYearStartMonth: 1,
  },
  availableTenants: [],
  memberships: [],
  currentRole: 'ADMIN',
  isSwitching: false,
  switchTenant: () => {},
  hasMinimumRole: () => true,
  isAdmin: true,
  canEdit: true,
}
