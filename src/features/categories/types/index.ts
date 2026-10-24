/**
 * Category domain models and classification types for Expense Wiki.
 * Matches backend Spring Boot CategoryController and OpenAPI v3 schemas.
 */

export interface Category {
  id: number
  parentCategoryId?: number | null
  level?: number // 1-based display position among siblings
  name: string
  description?: string
  icon?: string
  textColor?: string
  backgroundColor?: string
  monthlyBudget?: number
  active: boolean
  allowOverBudget: boolean
  tenantId?: number
  subCategories?: Category[]
}

export interface CategoryCreateRequest {
  name: string
  description?: string
  icon?: string
  textColor?: string
  backgroundColor?: string
  monthlyBudget?: number
  active: boolean
  allowOverBudget: boolean
  parentCategoryId?: number | null
  level?: number
}

export interface CategoryFilterState {
  search: string
  status: 'ALL' | 'ACTIVE' | 'INACTIVE'
  hasBudgetOnly: boolean
}
