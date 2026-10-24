import type { Category } from '../types'

export const compareCategoryLevels = (a: Category, b: Category) =>
  (a.level ?? Number.MAX_SAFE_INTEGER) - (b.level ?? Number.MAX_SAFE_INTEGER)

export function organizeCategories(categories: Category[]) {
  const flat: Category[] = []
  const visited = new Set<number>()
  const traverse = (category: Category, parentId: number | null = null) => {
    if (visited.has(category.id)) return
    visited.add(category.id)
    const normalized = {
      ...category,
      parentCategoryId: category.parentCategoryId ?? parentId,
    }
    flat.push(normalized)
    category.subCategories?.forEach((child) => traverse(child, category.id))
  }
  categories.forEach((category) => traverse(category))

  const topLevelCategories: Category[] = []
  const subcategoriesByParent: Record<number, Category[]> = {}
  for (const category of flat) {
    if (category.parentCategoryId != null) {
      (subcategoriesByParent[category.parentCategoryId] ??= []).push(category)
    } else {
      topLevelCategories.push(category)
    }
  }
  topLevelCategories.sort(compareCategoryLevels)
  Object.values(subcategoriesByParent).forEach((siblings) => siblings.sort(compareCategoryLevels))
  const ordered: Category[] = []
  const append = (category: Category) => {
    ordered.push(category)
    subcategoriesByParent[category.id]?.forEach(append)
  }
  topLevelCategories.forEach(append)
  const orderedIds = new Set(ordered.map((category) => category.id))
  return {
    topLevelCategories,
    subcategoriesByParent,
    allFlatCategories: [...ordered, ...flat.filter((category) => !orderedIds.has(category.id))],
  }
}
