import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/query-keys'
import { configurationService } from '../services/configurationService'
import type { TenantConfigurationRequest } from '../types'

export function useConfiguration(tenantId: number | string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tenantScope(tenantId).configuration.general(),
    queryFn: ({ signal }) => configurationService.get(tenantId, signal),
    staleTime: 30_000,
    enabled,
  })
}

export function useUpdateConfiguration(tenantId: number | string) {
  const client = useQueryClient()
  return useMutation({
    onMutate: () => client.cancelQueries({
      queryKey: queryKeys.tenantScope(tenantId).configuration.general(),
      exact: true,
    }),
    mutationFn: (payload: TenantConfigurationRequest) => configurationService.update(tenantId, payload),
    onSuccess: (config) => {
      client.setQueryData(queryKeys.tenantScope(tenantId).configuration.general(), config)
    },
  })
}
