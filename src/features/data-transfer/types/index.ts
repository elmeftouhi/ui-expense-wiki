export interface BackupSnapshotMetadata {
  formatVersion?: string
  exportedAt?: string
  tenantId?: number | string
  tenantName?: string
  [key: string]: unknown
}

export interface UserDataBackupSnapshot {
  metadata?: BackupSnapshotMetadata
  configuration?: Record<string, unknown> | null
  exercices?: unknown[]
  categories?: unknown[]
  paymentMethods?: unknown[]
  budgets?: unknown[]
  budgetPeriodInstances?: unknown[]
  subscriptions?: unknown[]
  expenses?: unknown[]
  subscriptionPayments?: unknown[]
  notifications?: unknown[]
  activityLogs?: unknown[]
  [key: string]: unknown
}

export interface ImportUserDataRequest {
  tenantName: string
  switchDefaultTenant: boolean
  backup: UserDataBackupSnapshot
}

export interface ImportedDataCounts {
  exercices: number
  categories: number
  paymentMethods: number
  budgets: number
  budgetPeriodInstances: number
  subscriptions: number
  expenses: number
  subscriptionPayments: number
  notifications: number
  activityLogs: number
}

export interface ImportUserDataResponse {
  tenantId: number
  tenantName: string
  switchedDefaultTenant: boolean
  counts: ImportedDataCounts
}

