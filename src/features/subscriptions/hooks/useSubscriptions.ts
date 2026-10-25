import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/query-keys'
import { useActiveTenant } from '@/features/tenants'
import { subscriptionService } from '../services/subscriptionService'
import type { BackfillSubscriptionPaymentRequest, SubscriptionCostFilters, SubscriptionFilters, SubscriptionPageParams, SubscriptionWriteRequest } from '../types'

const STALE_TIME = 30_000
const validId = (id: number | undefined): id is number =>
  typeof id === 'number' && Number.isSafeInteger(id) && id > 0

function useSubscriptionKeys() {
  return queryKeys.tenantScope(useActiveTenant().activeTenant.id).subscriptions
}

export function useSubscriptions(filters: SubscriptionFilters) {
  const keys = useSubscriptionKeys()
  return useQuery({
    queryKey: keys.list({ ...filters }),
    queryFn: () => subscriptionService.list(filters),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useSubscriptionRecurringCosts(filters: SubscriptionCostFilters) {
  const keys = useSubscriptionKeys()
  return useQuery({
    queryKey: keys.recurringCosts({ ...filters }),
    queryFn: () => subscriptionService.recurringCosts(filters),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useSubscription(id: number | undefined) {
  const keys = useSubscriptionKeys()
  return useQuery({
    queryKey: keys.detail(id ?? 'none'),
    queryFn: () => {
      if (!validId(id)) throw new Error('A valid subscription ID is required.')
      return subscriptionService.getById(id)
    },
    enabled: validId(id),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useSubscriptionPayments(id: number | undefined, params: SubscriptionPageParams) {
  const keys = useSubscriptionKeys()
  return useQuery({
    queryKey: keys.payments(id ?? 'none', { ...params }),
    queryFn: () => {
      if (!validId(id)) throw new Error('A valid subscription ID is required.')
      return subscriptionService.payments(id, params)
    },
    enabled: validId(id),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useSubscriptionPayment(id: number | undefined) {
  const keys = queryKeys.tenantScope(useActiveTenant().activeTenant.id).subscriptionPayments
  return useQuery({
    queryKey: keys.detail(id ?? 'none'),
    queryFn: () => {
      if (!validId(id)) throw new Error('A valid payment ID is required.')
      return subscriptionService.getPaymentById(id)
    },
    enabled: validId(id),
    staleTime: STALE_TIME,
  })
}

function useInvalidateBillingQueries() {
  const queryClient = useQueryClient()
  const keys = queryKeys.tenantScope(useActiveTenant().activeTenant.id)
  return () => Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.subscriptions.all }),
    queryClient.invalidateQueries({ queryKey: keys.subscriptionPayments.all }),
    queryClient.invalidateQueries({ queryKey: keys.expenses.all }),
    queryClient.invalidateQueries({ queryKey: keys.budgets.all }),
    queryClient.invalidateQueries({ queryKey: keys.dashboard.stats() }),
  ])
}

export function useGenerateNextPayment() {
  const invalidateBilling = useInvalidateBillingQueries()
  return useMutation({
    mutationFn: (id: number) => subscriptionService.generateNextPayment(id),
    retry: false,
    onSuccess: async () => {
      await invalidateBilling()
    },
  })
}

export function useBackfillSubscriptionPayment() {
  const invalidateBilling = useInvalidateBillingQueries()
  return useMutation({
    mutationFn: ({ subscriptionId, payload }: { subscriptionId: number; payload: BackfillSubscriptionPaymentRequest }) =>
      subscriptionService.backfillSubscriptionPayment(subscriptionId, payload),
    retry: false,
    onSuccess: async () => {
      await invalidateBilling()
    },
  })
}

function useInvalidateSubscriptionQueries() {
  const queryClient = useQueryClient()
  const keys = useSubscriptionKeys()
  return (subscriptionId?: number) => {
    void queryClient.invalidateQueries({ queryKey: keys.all })
    if (subscriptionId !== undefined) {
      void queryClient.invalidateQueries({ queryKey: keys.detail(subscriptionId) })
    }
  }
}

export function useCreateSubscription() {
  const queryClient = useQueryClient()
  const keys = useSubscriptionKeys()
  const invalidate = useInvalidateSubscriptionQueries()
  return useMutation({
    mutationFn: (payload: SubscriptionWriteRequest) => subscriptionService.create(payload),
    onSuccess: (created) => {
      queryClient.setQueryData(keys.detail(created.id), created)
      invalidate(created.id)
    },
  })
}

export function useUpdateSubscription() {
  const queryClient = useQueryClient()
  const keys = useSubscriptionKeys()
  const invalidate = useInvalidateSubscriptionQueries()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: SubscriptionWriteRequest }) =>
      subscriptionService.update(id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.detail(updated.id), updated)
      invalidate(updated.id)
    },
  })
}

export function usePauseSubscription() {
  const queryClient = useQueryClient()
  const keys = useSubscriptionKeys()
  const invalidate = useInvalidateSubscriptionQueries()
  return useMutation({
    mutationFn: (id: number) => subscriptionService.pause(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.detail(updated.id), updated)
      invalidate(updated.id)
    },
  })
}

export function useResumeSubscription() {
  const queryClient = useQueryClient()
  const keys = useSubscriptionKeys()
  const invalidate = useInvalidateSubscriptionQueries()
  return useMutation({
    mutationFn: ({ id, nextBillingDate }: { id: number; nextBillingDate: string }) =>
      subscriptionService.resume(id, { nextBillingDate }),
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.detail(updated.id), updated)
      invalidate(updated.id)
    },
  })
}

export function useStopSubscription() {
  const queryClient = useQueryClient()
  const keys = useSubscriptionKeys()
  const invalidate = useInvalidateSubscriptionQueries()
  return useMutation({
    mutationFn: (id: number) => subscriptionService.stop(id),
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.detail(updated.id), updated)
      invalidate(updated.id)
    },
  })
}
