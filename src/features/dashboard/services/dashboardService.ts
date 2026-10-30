import { z } from 'zod'
import { apiClient } from '@/api/client'
import type { DashboardSummary } from '../types'

const amount = z.union([
  z.number(),
  z.string().trim().min(1).transform(Number),
]).pipe(z.number().finite())
const count = amount.pipe(z.number().int().min(0))

const periodSchema = z.object({
  currentTotal: amount,
  previousTotal: amount,
  percentageChange: amount,
})

const dashboardSummarySchema = z.object({
  monthExpenses: periodSchema,
  yearExpenses: periodSchema,
  upcomingThisMonth: z.object({
    totalAmount: amount,
    count,
    nextExpenseLabel: z.string().nullish().transform((v) => v ?? null),
  }),
  overdue: z.object({ totalAmount: amount, count }),
  pending: z.object({ totalAmount: amount, count }),
  monthlyBudget: z.object({
    totalBudget: amount,
    usedPercentage: amount,
    totalRemaining: amount,
  }),
})

export async function fetchDashboardSummary(
  tenantId: string | number,
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  const raw = await apiClient.get<unknown>('/v1/dashboard/summary', { tenantId, signal })
  const result = dashboardSummarySchema.safeParse(raw)
  if (!result.success) {
    throw new Error('The server returned an invalid dashboard summary. Please try again.')
  }
  return result.data
}

export const dashboardService = { fetchDashboardSummary }
