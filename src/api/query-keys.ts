/**
 * TanStack Query Key Factory
 *
 * Ensures all tenant-scoped data queries include the active tenant ID in their root key tuple.
 * When switching tenants, queries can be invalidated or cancelled cleanly via queryKeys.tenantScope(tenantId).all.
 */

export type TenantIdParam = string | number

export const queryKeys = {
  // Tenant-agnostic keys (User profile, accessible tenant memberships list)
  auth: {
    all: ['auth'] as const,
    me: () => ['auth', 'me'] as const,
    myTenants: () => ['auth', 'my-tenants'] as const,
  },

  // Tenant administration (platform or multi-tenant management)
  tenants: {
    all: ['tenants'] as const,
    list: () => ['tenants', 'list'] as const,
    detail: (tenantId: TenantIdParam) => ['tenants', 'detail', tenantId] as const,
    members: (tenantId: TenantIdParam) => ['tenants', tenantId, 'members'] as const,
    invites: (tenantId: TenantIdParam) => ['tenants', tenantId, 'invites'] as const,
  },

  // Tenant-scoped domain queries
  tenantScope: (tenantId: TenantIdParam) => ({
    all: ['tenant', tenantId] as const,

    dashboard: {
      stats: (params?: Record<string, unknown>) => ['tenant', tenantId, 'dashboard', 'stats', params] as const,
      summary: () => ['tenant', tenantId, 'dashboard', 'summary'] as const,
      activity: () => ['tenant', tenantId, 'dashboard', 'activity'] as const,
    },

    expenses: {
      all: ['tenant', tenantId, 'expenses'] as const,
      list: (filters?: Record<string, unknown>) => ['tenant', tenantId, 'expenses', 'list', filters] as const,
      detail: (id: string | number) => ['tenant', tenantId, 'expenses', 'detail', id] as const,
      statistics: (params?: Record<string, unknown>) => ['tenant', tenantId, 'expenses', 'statistics', params] as const,
      overdue: () => ['tenant', tenantId, 'expenses', 'overdue'] as const,
      dailyChart: (year: number, month: number) => ['tenant', tenantId, 'expenses', 'charts', 'daily', year, month] as const,
      monthlyChart: (year: number) => ['tenant', tenantId, 'expenses', 'charts', 'monthly', year] as const,
    },

    subscriptions: {
      all: ['tenant', tenantId, 'subscriptions'] as const,
      recurringCosts: (filters?: Record<string, unknown>) => ['tenant', tenantId, 'subscriptions', 'recurring-costs', filters] as const,
      list: (filters?: Record<string, unknown>) => ['tenant', tenantId, 'subscriptions', 'list', filters] as const,
      detail: (id: string | number) => ['tenant', tenantId, 'subscriptions', 'detail', id] as const,
      payments: (id: string | number, page?: Record<string, unknown>) =>
        ['tenant', tenantId, 'subscriptions', 'detail', id, 'payments', page] as const,
    },

    subscriptionPayments: {
      all: ['tenant', tenantId, 'subscription-payments'] as const,
      detail: (id: string | number) => ['tenant', tenantId, 'subscription-payments', id] as const,
    },

    categories: {
      all: ['tenant', tenantId, 'categories'] as const,
      list: (params?: Record<string, unknown>) => ['tenant', tenantId, 'categories', 'list', params] as const,
      detail: (id: string | number) => ['tenant', tenantId, 'categories', 'detail', id] as const,
    },

    paymentMethods: {
      all: ['tenant', tenantId, 'payment-methods'] as const,
      list: (showInactive: boolean) => ['tenant', tenantId, 'payment-methods', { showInactive }] as const,
    },

    budgets: {
      all: ['tenant', tenantId, 'budgets'] as const,
      list: () => ['tenant', tenantId, 'budgets', 'list'] as const,
      detail: (id: string | number) => ['tenant', tenantId, 'budgets', 'detail', id] as const,
      periods: (id: string | number) => ['tenant', tenantId, 'budgets', 'detail', id, 'periods'] as const,
      history: (id: string | number, monthsBack?: number) =>
        ['tenant', tenantId, 'budgets', 'detail', id, 'history', monthsBack ?? 'default'] as const,
    },

    receipts: {
      all: ['tenant', tenantId, 'receipts'] as const,
      list: (params?: Record<string, unknown>) => ['tenant', tenantId, 'receipts', 'list', params] as const,
      detail: (id: string | number) => ['tenant', tenantId, 'receipts', 'detail', id] as const,
    },

    configuration: {
      all: ['tenant', tenantId, 'config'] as const,
      general: () => ['tenant', tenantId, 'config', 'general'] as const,
      fiscalYears: () => ['tenant', tenantId, 'config', 'fiscal-years'] as const,
    },

    users: {
      all: ['tenant', tenantId, 'users'] as const,
      list: () => ['tenant', tenantId, 'users', 'list'] as const,
      detail: (userId: string | number) => ['tenant', tenantId, 'users', 'detail', userId] as const,
    },

    notifications: {
      all: ['tenant', tenantId, 'notifications'] as const,
      unreadCount: () => ['tenant', tenantId, 'notifications', 'unread-count'] as const,
    },

    activityLogs: {
      all: ['tenant', tenantId, 'activity-logs'] as const,
      list: (params?: Record<string, unknown>) => ['tenant', tenantId, 'activity-logs', 'list', params] as const,
    },
  }),
}
