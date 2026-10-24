import { z } from 'zod'
import type { BudgetCreateRequest, BudgetPeriodUpdateRequest } from '../types'

export const BUDGET_NAME_MAX = 100
export const BUDGET_DESCRIPTION_MAX = 500

const amountSchema = z
  .number({ error: 'Enter a valid amount.' })
  .refine((n) => Number.isFinite(n), 'Enter a valid amount.')
  .refine((n) => n > 0, 'Amount must be greater than 0.')

const thresholdSchema = z
  .number({ error: 'Enter a warning threshold.' })
  .refine((n) => Number.isFinite(n), 'Enter a warning threshold.')
  .refine((n) => n >= 0, 'Threshold cannot be negative.')

const warningTypeSchema = z.enum(['AMOUNT', 'PERCENTAGE'])

interface WarningRuleShape {
  warningType: 'AMOUNT' | 'PERCENTAGE'
  warningThreshold: number
}

/** Shared API constraint for both budget defaults and individual periods. */
function validateWarningRule(data: WarningRuleShape, ctx: z.RefinementCtx) {
  if (!Number.isFinite(data.warningThreshold)) return
  if (data.warningType === 'PERCENTAGE' && data.warningThreshold > 100) {
    ctx.addIssue({
      code: 'custom',
      path: ['warningThreshold'],
      message: 'Percentage threshold cannot exceed 100%.',
    })
  }
}

export const budgetFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Budget name is required.')
      .max(BUDGET_NAME_MAX, `Name must be ${BUDGET_NAME_MAX} characters or fewer.`),
    description: z
      .string()
      .trim()
      .max(BUDGET_DESCRIPTION_MAX, `Description must be ${BUDGET_DESCRIPTION_MAX} characters or fewer.`),
    periodicity: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
    allocatedAmount: amountSchema,
    warningType: warningTypeSchema,
    warningThreshold: thresholdSchema,
    categoryIds: z.array(z.number().int().positive()).min(1, 'Select at least one category to track.'),
    active: z.boolean(),
  })
  .superRefine(validateWarningRule)

export type BudgetFormValues = z.infer<typeof budgetFormSchema>

export const periodUpdateSchema = z
  .object({
    allocatedAmount: amountSchema,
    warningType: warningTypeSchema,
    warningThreshold: thresholdSchema,
  })
  .superRefine(validateWarningRule)

export type PeriodUpdateFormValues = z.infer<typeof periodUpdateSchema>

export const DEFAULT_BUDGET_FORM_VALUES: BudgetFormValues = {
  name: '',
  description: '',
  periodicity: 'MONTHLY',
  allocatedAmount: Number.NaN,
  warningType: 'PERCENTAGE',
  warningThreshold: 80,
  categoryIds: [],
  active: true,
}

/** Maps validated form values to the API payload (trims, drops empty description, dedupes ids). */
export function toBudgetPayload(values: BudgetFormValues): BudgetCreateRequest {
  const description = values.description.trim()
  return {
    name: values.name.trim(),
    ...(description ? { description } : {}),
    periodicity: values.periodicity,
    allocatedAmount: values.allocatedAmount,
    warningType: values.warningType,
    warningThreshold: values.warningThreshold,
    categoryIds: Array.from(new Set(values.categoryIds)),
    active: values.active,
  }
}

export function toPeriodPayload(values: PeriodUpdateFormValues): BudgetPeriodUpdateRequest {
  return {
    allocatedAmount: values.allocatedAmount,
    warningType: values.warningType,
    warningThreshold: values.warningThreshold,
  }
}
