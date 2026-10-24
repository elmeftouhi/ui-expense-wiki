import type { Category } from '@/features/categories/types'
import { compareCategoryLevels } from '@/features/categories/utils/categoryOrder'

export interface CategoryOption {
  id: number
  name: string
  icon?: string
  depth: number
  active: boolean
  parentName?: string
  textColor?: string
  backgroundColor?: string
}

/**
 * Flattens the (possibly nested) categories response into an ordered option list:
 * parents first, each followed by its sub-categories, with siblings sorted by level.
 * Handles both flat lists using
 * `parentCategoryId` and trees using `subCategories`, de-duplicating by id.
 */
export function flattenCategoryOptions(categories: Category[]): CategoryOption[] {
  const byId = new Map<number, Category>()
  const visit = (c: Category, parentId?: number) => {
    if (byId.has(c.id)) return
    byId.set(c.id, { ...c, parentCategoryId: c.parentCategoryId ?? parentId })
    c.subCategories?.forEach((child) => visit(child, c.id))
  }
  categories.forEach((category) => visit(category))

  const childrenOf = new Map<number, Category[]>()
  const roots: Category[] = []
  for (const c of byId.values()) {
    if (c.parentCategoryId && byId.has(c.parentCategoryId)) {
      const list = childrenOf.get(c.parentCategoryId) ?? []
      list.push(c)
      childrenOf.set(c.parentCategoryId, list)
    } else {
      roots.push(c)
    }
  }

  const out: CategoryOption[] = []
  const emit = (c: Category, depth: number, parentName?: string) => {
    out.push({
      id: c.id,
      name: c.name,
      icon: c.icon,
      depth,
      active: c.active,
      parentName,
      textColor: c.textColor,
      backgroundColor: c.backgroundColor,
    })
    ;(childrenOf.get(c.id) ?? []).sort(compareCategoryLevels).forEach((child) => emit(child, depth + 1, c.name))
  }
  roots.sort(compareCategoryLevels).forEach((r) => emit(r, 0))
  return out
}
