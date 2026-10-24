import { z } from 'zod'

const numericValue = z.union([
  z.number(),
  z.string().trim().min(1).transform(Number),
]).pipe(z.number().finite())

export const budgetPeriodResponseSchema = z.object({
  id: z.number().int().positive(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  allocatedAmount: numericValue,
  spentAmount: numericValue,
  status: z.enum(['OPEN', 'CLOSED']),
  warningType: z.enum(['AMOUNT', 'PERCENTAGE']),
  warningThreshold: numericValue,
  warningSent: z.boolean().optional(),
  exceededSent: z.boolean().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const budgetResponseSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  description: z.string().nullish(),
  periodicity: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']),
  allocatedAmount: numericValue,
  warningType: z.enum(['AMOUNT', 'PERCENTAGE']),
  warningThreshold: numericValue,
  active: z.boolean(),
  categoryIds: z.array(z.number().int().positive()),
  tenantId: z.number().int().positive().optional(),
  currentPeriod: budgetPeriodResponseSchema.nullish(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})
