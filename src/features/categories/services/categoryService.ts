import { apiClient } from '@/api/client'
import type { Category, CategoryCreateRequest } from '../types'

export const categoryService = {
  async updateLevel(id: number, level: number): Promise<void> {
    await apiClient.patch<unknown>(`/v1/categories/${id}/level`, { level })
  },
  /**
   * Fetch all categories for the currently active tenant
   * Endpoint: GET /v1/categories?showInactive={boolean}
   */
  async getAll(showInactive: boolean = true): Promise<Category[]> {
    return apiClient.get<Category[]>('/v1/categories', {
      params: { showInactive },
    })
  },

  /**
   * Get single category details by ID
   * Endpoint: GET /v1/categories/{id}
   */
  async getById(id: number): Promise<Category> {
    return apiClient.get<Category>(`/v1/categories/${id}`)
  },

  /**
   * Create a new category or subcategory
   * Endpoint: POST /v1/categories
   */
  async create(payload: CategoryCreateRequest): Promise<Category> {
    return apiClient.post<Category>('/v1/categories', payload)
  },

  /**
   * Update an existing category
   * Endpoint: PUT /v1/categories/{id}
   */
  async update(id: number, payload: CategoryCreateRequest): Promise<Category> {
    return apiClient.put<Category>(`/v1/categories/${id}`, payload)
  },

  /**
   * Delete category by ID
   * Endpoint: DELETE /v1/categories/{id}
   */
  async delete(id: number): Promise<void> {
    return apiClient.del<void>(`/v1/categories/${id}`)
  },

  /**
   * Toggle active status of a category
   * Endpoint: PATCH /v1/categories/{id}/status
   */
  async toggleStatus(id: number): Promise<Category> {
    return apiClient.patch<Category>(`/v1/categories/${id}/status`)
  },
}
