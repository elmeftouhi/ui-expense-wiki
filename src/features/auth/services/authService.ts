import { apiClient } from '@/api/client'
import type { AuthResponse, CurrentUserResponse, LoginRequest, RegisterRequest } from '../types'
import { authStorage } from './authStorage'

export const authService = {
  /**
   * Login with email and password
   * Endpoint: POST /v1/auth/login
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/v1/auth/login', credentials, {
      skipAuth: true,
    })

    if (response.accessToken) {
      authStorage.setToken(response.accessToken)
      if (response.selectedTenantId) {
        authStorage.setSelectedTenantId(response.selectedTenantId)
      }
    }

    return response
  },

  /**
   * Register a new user and create their initial tenant organization
   * Endpoint: POST /v1/auth/register
   */
  async register(payload: RegisterRequest): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/v1/auth/register', payload, {
      skipAuth: true,
    })

    if (response.accessToken) {
      authStorage.setToken(response.accessToken)
      if (response.selectedTenantId) {
        authStorage.setSelectedTenantId(response.selectedTenantId)
      }
    }

    return response
  },

  /**
   * Invalidate session and logout
   * Endpoint: POST /v1/auth/logout
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post<void>('/v1/auth/logout')
    } catch {
      // Even if network fails or token expired, proceed to clear local credentials
    } finally {
      authStorage.clearAll()
    }
  },

  /**
   * Fetch the authenticated user's profile, including the last used tenant
   * Endpoint: GET /v1/me
   */
  async getMe(): Promise<CurrentUserResponse> {
    return apiClient.get<CurrentUserResponse>('/v1/me')
  },

  /**
   * Switch the active tenant context on the backend
   * Endpoint: POST /v1/auth/switch-tenant
   */
  async switchTenant(tenantId: number): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/v1/auth/switch-tenant', {
      tenantId,
    })

    if (response.accessToken) {
      authStorage.setToken(response.accessToken)
      authStorage.setSelectedTenantId(response.selectedTenantId)
    }

    return response
  },
}
