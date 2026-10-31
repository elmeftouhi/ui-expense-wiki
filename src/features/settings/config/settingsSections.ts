import type { ComponentType } from 'react'
import { ArrowLeftRight, Bell, Coins, CreditCard, Globe } from 'lucide-react'
import type { ConfigurationFormValues } from '../schemas/configurationSchema'

/**
 * Extensible identifier for workspace settings sections.
 * To add a new configuration area in the future (e.g. 'fiscal-years', 'approvals', 'tax-rules'):
 * 1. Add its key to `SettingsSectionId`
 * 2. Append an entry to `SETTINGS_SECTIONS`
 * 3. Render its panel in `SettingsPage`
 */
export type SettingsSectionId =
  | 'financial'
  | 'regional'
  | 'alerts'
  | 'payment-methods'
  | 'data-transfer'

export interface SettingsSectionMeta {
  id: SettingsSectionId
  group: string
  label: string
  description: string
  icon: ComponentType<{ className?: string }>
  /** Form fields belonging to `/v1/config` for dirty/validation tracking across tabs. */
  configFields?: (keyof ConfigurationFormValues)[]
}

export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  {
    id: 'financial',
    group: 'Workspace',
    label: 'Financial',
    description: 'Default currency, decimal precision, rounding, and reporting cycle.',
    icon: Coins,
    configFields: [
      'currency',
      'decimalPlaces',
      'expenseRoundingMethod',
      'reportingPeriod',
    ],
  },
  {
    id: 'regional',
    group: 'Workspace',
    label: 'Regional',
    description: 'Language, timezone, date pattern, clock format, and week start.',
    icon: Globe,
    configFields: [
      'language',
      'timezone',
      'dateFormat',
      'timeFormat',
      'weekStartDay',
    ],
  },
  {
    id: 'alerts',
    group: 'Workspace',
    label: 'Alerts & reminders',
    description: 'Budget warning thresholds, channels, and upcoming payment lead days.',
    icon: Bell,
    configFields: [
      'budgetAlertThreshold',
      'notificationChannels',
      'autoPaymentReminderDays',
    ],
  },
  {
    id: 'payment-methods',
    group: 'Payments',
    label: 'Payment methods',
    description: 'Manage cards, accounts, and the default method for new entries.',
    icon: CreditCard,
  },
  {
    id: 'data-transfer',
    group: 'Data',
    label: 'Data Transfer',
    description: 'Export workspace backups as JSON or restore a backup into a new workspace.',
    icon: ArrowLeftRight,
  },
]

export function groupSettingsSections(sections: SettingsSectionMeta[] = SETTINGS_SECTIONS) {
  const map = new Map<string, SettingsSectionMeta[]>()
  for (const section of sections) {
    const bucket = map.get(section.group) ?? []
    bucket.push(section)
    map.set(section.group, bucket)
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }))
}

export function isSettingsSectionId(value: string | null | undefined): value is SettingsSectionId {
  return Boolean(value && SETTINGS_SECTIONS.some((section) => section.id === value))
}

