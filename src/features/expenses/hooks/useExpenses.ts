import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/api/query-keys'
import { useActiveTenant } from '@/features/tenants'
import { expenseService } from '../services/expenseService'
import type {
  ExpenseListFilters,
  ExpenseStatisticsFilters,
  ExpenseStatusChangeRequest,
  ExpenseUpsertRequest,
} from '../types'

const STALE_TIME = 30_000
const validId = (id: number | undefined): id is number =>
  typeof id === 'number' && Number.isSafeInteger(id) && id > 0

function useExpenseKeys() {
  return queryKeys.tenantScope(useActiveTenant().activeTenant.id).expenses
}

function useInvalidateExpenseData() {
  const queryClient = useQueryClient()
  const tenantKeys = queryKeys.tenantScope(useActiveTenant().activeTenant.id)

  return (id?: number) => {
    void queryClient.invalidateQueries({ queryKey: tenantKeys.expenses.all })
    void queryClient.invalidateQueries({ queryKey: tenantKeys.budgets.all })
    void queryClient.invalidateQueries({ queryKey: tenantKeys.dashboard.stats() })
    void queryClient.invalidateQueries({ queryKey: tenantKeys.subscriptions.all })
    void queryClient.invalidateQueries({ queryKey: tenantKeys.subscriptionPayments.all })
    if (id !== undefined) void queryClient.invalidateQueries({ queryKey: tenantKeys.expenses.detail(id) })
  }
}

export function useExpenses(filters: ExpenseListFilters) {
  const keys = useExpenseKeys()
  return useQuery({
    queryKey: keys.list({ ...filters }),
    queryFn: () => expenseService.list(filters),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })
}

export function useExpense(id: number | undefined) {
  const keys = useExpenseKeys()
  return useQuery({
    queryKey: keys.detail(id ?? 'none'),
    queryFn: () => {
      if (!validId(id)) throw new Error('A valid expense ID is required.')
      return expenseService.getById(id)
    },
    enabled: validId(id),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useOverdueExpenses() {
  const keys = useExpenseKeys()
  return useQuery({
    queryKey: keys.overdue(),
    queryFn: () => expenseService.overdue(),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useExpenseStatistics(filters: ExpenseStatisticsFilters) {
  const keys = useExpenseKeys()
  return useQuery({
    queryKey: keys.statistics({ ...filters }),
    queryFn: () => expenseService.statistics(filters),
    enabled: Boolean(filters.startDate && filters.endDate && filters.startDate <= filters.endDate),
    staleTime: STALE_TIME,
    refetchOnWindowFocus: true,
  })
}

export function useCreateExpense() {
  const keys = useExpenseKeys()
  const queryClient = useQueryClient()
  const invalidate = useInvalidateExpenseData()
  return useMutation({
    mutationFn: (payload: ExpenseUpsertRequest) => expenseService.create(payload),
    onSuccess: (expense) => {
      queryClient.setQueryData(keys.detail(expense.id), expense)
      invalidate(expense.id)
    },
  })
}

export function useUpdateExpense() {
  const keys = useExpenseKeys()
  const queryClient = useQueryClient()
  const invalidate = useInvalidateExpenseData()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ExpenseUpsertRequest }) =>
      expenseService.update(id, payload),
    onSuccess: (expense) => {
      queryClient.setQueryData(keys.detail(expense.id), expense)
      invalidate(expense.id)
    },
  })
}

export function useDeleteExpense() {
  const queryClient = useQueryClient()
  const keys = useExpenseKeys()
  const invalidate = useInvalidateExpenseData()
  return useMutation({
    mutationFn: (id: number) => expenseService.delete(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: keys.detail(id) })
      invalidate(id)
    },
  })
}

export function useChangeExpenseStatus() {
  const keys = useExpenseKeys()
  const queryClient = useQueryClient()
  const invalidate = useInvalidateExpenseData()
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: ExpenseStatusChangeRequest }) =>
      expenseService.changeStatus(id, payload),
    onSuccess: (expense) => {
      queryClient.setQueryData(keys.detail(expense.id), expense)
      invalidate(expense.id)
    },
  })
}

export function useMarkExpenseAsPaid() {
  const keys = useExpenseKeys()
  const queryClient = useQueryClient()
  const invalidate = useInvalidateExpenseData()
  return useMutation({
    mutationFn: ({ id, paidDate }: { id: number; paidDate: string }) =>
      expenseService.markAsPaid(id, paidDate),
    onSuccess: (expense) => {
      queryClient.setQueryData(keys.detail(expense.id), expense)
      invalidate(expense.id)
    },
  })
}
