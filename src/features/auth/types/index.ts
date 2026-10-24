/**
 * Authentication domain types, requests, and backend response models.
 */

export interface AuthResponse {
  accessToken: string
  tokenType: string
  expiresInMinutes: number
  selectedTenantId: number
  allowedTenantIds: number[]
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest {
  email: string
  password: string
  tenantName: string
  firstName?: string
  lastName?: string
  phone?: string
}

export interface AuthUser {
  id: number | string
  email: string
  displayedName?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  status?: string
  tenantName?: string
  defaultTenantId?: number | null
  currentTenantId?: number | null
  selectedTenantId?: number
  allowedTenantIds?: number[]
  roles: string[]
}

/**
 * Payload returned by GET /v1/me
 */
export interface CurrentUserResponse {
  id: number
  email: string
  displayedName?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  status?: string
  defaultTenantId?: number | null
  currentTenantId?: number | null
  roles: string[]
}

export interface AuthSession {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
}
