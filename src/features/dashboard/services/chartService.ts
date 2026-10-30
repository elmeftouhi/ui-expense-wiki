import { z } from 'zod'
import { apiClient } from '@/api/client'

const total = z.union([
  z.number(),
  z.string().trim().min(1).transform(Number),
]).pipe(z.number().finite())
const monthTotal = z.object({ month: z.number().int().min(1).max(12), total })
const year = z.number().int().min(1).max(9999)

const dayTotal = z.object({ day: z.number().int().min(1).max(31), total })
const dailyChartSchema = z.object({
  year,
  month: z.number().int().min(1).max(12),
  totals: z.array(dayTotal),
  previousMonthTotals: z.array(dayTotal).nullish().transform((v) => v ?? []),
})
const monthlyChartSchema = z.object({
  year,
  totals: z.array(monthTotal),
  previousYearTotals: z.array(monthTotal),
})

function parseChart<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw)
  if (!result.success) {
    throw new Error('The server returned invalid chart data. Refresh the page or contact support.')
  }
  return result.data
}

export const chartService = {
  async daily(tenantId: string | number, year: number, month: number, signal?: AbortSignal) {
    return parseChart(dailyChartSchema, await apiClient.get<unknown>('/v1/expenses/charts/daily', {
      tenantId, params: { year, month }, signal,
    }))
  },
  async monthly(tenantId: string | number, year: number, signal?: AbortSignal) {
    return parseChart(monthlyChartSchema, await apiClient.get<unknown>('/v1/expenses/charts/monthly', {
      tenantId, params: { year }, signal,
    }))
  },
}
