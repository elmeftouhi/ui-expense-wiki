import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { categoryService } from '../services/categoryService'
import type { Category, CategoryCreateRequest } from '../types'
import { useActiveTenant } from '@/features/tenants'
import { queryKeys } from '@/api/query-keys'

export const CATEGORIES_QUERY_KEY = 'categories'

export function useReorderCategory() {
  const queryClient = useQueryClient()
  const { activeTenant } = useActiveTenant()
  return useMutation({
    mutationFn: ({ id, level }: { id: number; level: number }) =>
      categoryService.updateLevel(id, level),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: [CATEGORIES_QUERY_KEY, activeTenant.id] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.tenantScope(activeTenant.id).categories.all }),
      ])
    },
  })
}

export function useCategories(showInactive: boolean = true) {
  const { activeTenant } = useActiveTenant()

  return useQuery<Category[], Error>({
    queryKey: [CATEGORIES_QUERY_KEY, activeTenant.id, { showInactive }],
    queryFn: () => categoryService.getAll(showInactive),
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  })
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  const { activeTenant } = useActiveTenant()

  return useMutation({
    mutationFn: (payload: CategoryCreateRequest) => categoryService.create(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [CATEGORIES_QUERY_KEY, activeTenant.id],
      })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()
  const { activeTenant } = useActiveTenant()

  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CategoryCreateRequest }) =>
      categoryService.update(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [CATEGORIES_QUERY_KEY, activeTenant.id],
      })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  const { activeTenant } = useActiveTenant()

  return useMutation({
    mutationFn: (id: number) => categoryService.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [CATEGORIES_QUERY_KEY, activeTenant.id],
      })
    },
  })
}

export function useToggleCategoryStatus() {
  const queryClient = useQueryClient()
  const { activeTenant } = useActiveTenant()

  return useMutation({
    mutationFn: (id: number) => categoryService.toggleStatus(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: [CATEGORIES_QUERY_KEY, activeTenant.id],
      })
    },
  })
}
