import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/query-keys'
import { chartService } from '../services/chartService'

export function useDailyExpenseChart(tenantId: string | number, year: number, month: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.tenantScope(tenantId).expenses.dailyChart(year, month),
    queryFn: ({ signal }) => chartService.daily(tenantId, year, month, signal),
    enabled,
    staleTime: 30_000,
  })
}

export function useMonthlyExpenseChart(tenantId: string | number, year: number, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.tenantScope(tenantId).expenses.monthlyChart(year),
    queryFn: ({ signal }) => chartService.monthly(tenantId, year, signal),
    enabled,
    staleTime: 30_000,
  })
}
