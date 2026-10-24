import { useMemo } from 'react'
import { useCategories } from '@/features/categories/hooks/useCategories'
import { flattenCategoryOptions, type CategoryOption } from '../utils/categoryOptions'

/** Categories for the active tenant, flattened for the budget multi-select plus an id lookup map. */
export function useCategoryOptions() {
  const query = useCategories(true)
  const options = useMemo(() => flattenCategoryOptions(query.data ?? []), [query.data])
  const byId = useMemo(() => new Map<number, CategoryOption>(options.map((o) => [o.id, o])), [options])
  return { options, byId, isLoading: query.isLoading, error: query.error, refetch: query.refetch }
}
