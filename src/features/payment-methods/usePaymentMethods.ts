import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/query-keys'
import { useActiveTenant } from '@/features/tenants'
import { paymentMethodService, type PaymentMethodRequest } from './paymentMethodService'

export function usePaymentMethods(showInactive = false) {
  const { activeTenant } = useActiveTenant()
  return useQuery({
    queryKey: queryKeys.tenantScope(activeTenant.id).paymentMethods.list(showInactive),
    queryFn: () => paymentMethodService.list(activeTenant.id, showInactive),
    staleTime: 30_000,
  })
}

type PaymentMethodAction =
  | { action: 'create'; payload: PaymentMethodRequest }
  | { action: 'update'; id: number; payload: PaymentMethodRequest }
  | { action: 'set-default'; id: number }

export function useSavePaymentMethod() {
  const { activeTenant } = useActiveTenant()
  const client = useQueryClient()
  const keys = queryKeys.tenantScope(activeTenant.id)
  return useMutation({
    mutationFn: (action: PaymentMethodAction) => {
      if (action.action === 'create') return paymentMethodService.create(activeTenant.id, action.payload)
      if (action.action === 'update') return paymentMethodService.update(activeTenant.id, action.id, action.payload)
      return paymentMethodService.setDefault(activeTenant.id, action.id)
    },
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.paymentMethods.all }),
        client.invalidateQueries({ queryKey: keys.expenses.all }),
        client.invalidateQueries({ queryKey: keys.subscriptions.all }),
        client.invalidateQueries({ queryKey: keys.dashboard.stats() }),
      ])
    },
  })
}
