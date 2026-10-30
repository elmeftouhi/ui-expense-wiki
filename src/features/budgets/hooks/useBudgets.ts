import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiClientError } from '@/api/client'
import { queryKeys } from '@/api/query-keys'
import { useActiveTenant } from '@/features/tenants'
import { budgetService, isValidMonthsBack } from '../services/budgetService'
import type {
  Budget,
  BudgetCreateRequest,
  BudgetPeriod,
  BudgetPeriodResponse,
  BudgetPeriodUpdateRequest,
} from '../types'

const BUDGET_STALE_TIME = 1000 * 30 // spend is recalculated server-side on expense changes

function useBudgetKeys() {
  const { activeTenant } = useActiveTenant()
  return queryKeys.tenantScope(activeTenant.id).budgets
}

const validId = (id: number | undefined): id is number =>
  typeof id === 'number' && Number.isSafeInteger(id) && id > 0

export function useBudgets() {
  const keys = useBudgetKeys()
  return useQuery<Budget[], Error>({
    queryKey: keys.list(),
    queryFn: () => budgetService.getAll(),
    staleTime: BUDGET_STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useBudget(id: number | undefined) {
  const keys = useBudgetKeys()
  return useQuery<Budget, Error>({
    queryKey: keys.detail(id ?? 'none'),
    queryFn: () => {
      if (!validId(id)) throw new Error('A valid budget ID is required.')
      return budgetService.getById(id)
    },
    enabled: validId(id),
    staleTime: BUDGET_STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useBudgetPeriods(id: number | undefined) {
  const keys = useBudgetKeys()
  return useQuery<BudgetPeriod[], Error>({
    queryKey: keys.periods(id ?? 'none'),
    queryFn: () => {
      if (!validId(id)) throw new Error('A valid budget ID is required.')
      return budgetService.getPeriods(id)
    },
    enabled: validId(id),
    staleTime: BUDGET_STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useBudgetHistory(id: number | undefined, monthsBack?: number) {
  const keys = useBudgetKeys()
  const queryClient = useQueryClient()
  const defaultRetry = queryClient.getDefaultOptions().queries?.retry ?? 3
  const enabled = validId(id) && (monthsBack === undefined || isValidMonthsBack(monthsBack))
  return useQuery<BudgetPeriodResponse[], Error>({
    queryKey: keys.history(id ?? 'none', monthsBack),
    queryFn: () => {
      if (!validId(id)) throw new Error('A valid budget ID is required.')
      return budgetService.getHistory(id, monthsBack)
    },
    enabled,
    staleTime: BUDGET_STALE_TIME,
    refetchOnWindowFocus: true,
    // 4xx (e.g. 400 for an out-of-range monthsBack) won't succeed on retry; otherwise use the client default.
    retry: (failureCount, error) => {
      if (error instanceof ApiClientError && error.status >= 400 && error.status < 500) return false
      if (typeof defaultRetry === 'function') return defaultRetry(failureCount, error)
      if (typeof defaultRetry === 'number') return failureCount < defaultRetry
      return defaultRetry
    },
  })
}

export function useCreateBudget() {
  const queryClient = useQueryClient()
  const keys = useBudgetKeys()
  return useMutation({
    mutationFn: (payload: BudgetCreateRequest) => budgetService.create(payload),
    onSuccess: (created) => {
      queryClient.setQueryData(keys.detail(created.id), created)
      void queryClient.invalidateQueries({ queryKey: keys.list() })
    },
  })
}

export function useUpdateBudget() {
  const queryClient = useQueryClient()
  const keys = useBudgetKeys()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: BudgetCreateRequest }) =>
      budgetService.update(id, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.detail(updated.id), updated)
      void queryClient.invalidateQueries({ queryKey: keys.all })
    },
  })
}

export function useUpdateBudgetPeriod(budgetId: number) {
  const queryClient = useQueryClient()
  const keys = useBudgetKeys()
  return useMutation({
    mutationFn: ({ periodId, payload }: { periodId: number; payload: BudgetPeriodUpdateRequest }) =>
      budgetService.updatePeriod(budgetId, periodId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData<BudgetPeriod[]>(keys.periods(budgetId), (prev) =>
        prev?.map((p) => (p.id === updated.id ? updated : p)),
      )
      // The edited period may be the budget's current period shown on detail + list views.
      void queryClient.invalidateQueries({ queryKey: keys.all })
    },
  })
}
