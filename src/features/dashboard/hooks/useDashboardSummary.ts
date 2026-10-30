import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/api/query-keys'
import { dashboardService } from '../services/dashboardService'

export function useDashboardSummary(tenantId: string | number) {
  const query = useQuery({
    queryKey: queryKeys.tenantScope(tenantId).dashboard.summary(),
    queryFn: ({ signal }) => dashboardService.fetchDashboardSummary(tenantId, signal),
    staleTime: 30_000,
  })

  const { isFetching, refetch } = query
  // Ignore clicks while a request is in flight so refreshes never overlap.
  const refresh = useCallback(() => {
    if (isFetching) return
    void refetch({ cancelRefetch: false })
  }, [isFetching, refetch])

  return {
    data: query.data,
    error: query.error,
    isLoading: query.isPending,
    isRefreshing: query.isFetching,
    refresh,
  }
}
