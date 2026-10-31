import { z } from 'zod'
import type {
  ImportedDataCounts,
  ImportUserDataRequest,
  ImportUserDataResponse,
  UserDataBackupSnapshot,
} from '../types'

export const EXPECTED_BACKUP_FORMAT_VERSION = '1.0'

export const userDataBackupSnapshotSchema = z
  .record(z.string(), z.unknown())
  .refine((val) => !Array.isArray(val), {
    message: 'Backup snapshot must be a JSON object.',
  }) as z.ZodType<UserDataBackupSnapshot>

const nonNegativeCount = z.number().int().nonnegative().default(0)

export const importedDataCountsSchema: z.ZodType<ImportedDataCounts> = z.object({
  exercices: nonNegativeCount,
  categories: nonNegativeCount,
  paymentMethods: nonNegativeCount,
  budgets: nonNegativeCount,
  budgetPeriodInstances: nonNegativeCount,
  subscriptions: nonNegativeCount,
  expenses: nonNegativeCount,
  subscriptionPayments: nonNegativeCount,
  notifications: nonNegativeCount,
  activityLogs: nonNegativeCount,
})

export const importUserDataRequestSchema: z.ZodType<ImportUserDataRequest> = z.object({
  tenantName: z.string().trim().min(1, 'Enter a name for the new workspace.'),
  switchDefaultTenant: z.boolean(),
  backup: userDataBackupSnapshotSchema,
})

export const importUserDataResponseSchema: z.ZodType<ImportUserDataResponse> = z.object({
  tenantId: z.number().int(),
  tenantName: z.string().min(1),
  switchedDefaultTenant: z.boolean(),
  counts: importedDataCountsSchema,
})

