import type { Budget, BudgetCreateRequest, BudgetPeriod } from '../types'
import type { CategoryOption } from '../utils/categoryOptions'
import type { TenantContextValue } from '@/features/tenants/types'

export const period: BudgetPeriod = {
  id: 10,
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  allocatedAmount: 1000,
  spentAmount: 850,
  warningType: 'PERCENTAGE',
  warningThreshold: 80,
  status: 'OPEN',
}

export const payload: BudgetCreateRequest = {
  name: 'Cloud services',
  description: 'Infrastructure costs',
  periodicity: 'MONTHLY',
  allocatedAmount: 1000,
  warningType: 'PERCENTAGE',
  warningThreshold: 80,
  categoryIds: [1],
  active: true,
}

export const budget: Budget = { ...payload, id: 1, currentPeriod: period }

export const categoryOptions: CategoryOption[] = [
  { id: 1, name: 'Software', depth: 0, active: true },
  { id: 2, name: 'Hosting', depth: 1, parentName: 'Software', active: true },
  { id: 3, name: 'Travel', depth: 0, active: false },
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
