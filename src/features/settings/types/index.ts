/**
 * Settings and organization configuration types.
 */
import type { z } from 'zod'
import type { configurationRequestSchema, configurationResponseSchema } from '../schemas/configurationSchema'

export type TenantConfigurationRequest = z.infer<typeof configurationRequestSchema>
export type TenantConfiguration = z.infer<typeof configurationResponseSchema>

export interface OrganizationSettings {
  tenantId: number | string
  companyName: string
  taxIdentificationNumber?: string
  defaultCurrency: string
  defaultLocale: string
  fiscalYearStartMonth: number
  allowEmployeeReceiptUpload: boolean
  requireApprovalOverAmount?: number
}

export interface UserPreferences {
  theme: 'system' | 'light' | 'dark'
  preferredLocale?: string
  preferredCurrency?: string
  emailNotifications: boolean
}
