import { apiClient } from '@/api/client'
import type { AuthResponse } from '@/features/auth/types'
import type {
  TenantUser,
  CreateTenantInviteRequest,
  TenantInviteResponse,
  DirectAddUserRequest,
} from '../types'

export interface BackendTenantMembership {
  id: number
  name: string
  isDefault: boolean
  role: 'ADMIN' | 'EDITOR' | 'VIEWER'
}

export interface CreateTenantRequest {
  tenantName: string
}

export const tenantService = {
  /**
   * Fetch all tenants the current authenticated user belongs to
   * Endpoint: GET /v1/me/tenants
   */
  async getMyTenants(): Promise<BackendTenantMembership[]> {
    return apiClient.get<BackendTenantMembership[]>('/v1/me/tenants')
  },

  /**
   * Switch active tenant context and receive updated JWT token
   * Endpoint: POST /v1/auth/switch-tenant
   */
  async switchTenant(tenantId: number): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/v1/auth/switch-tenant', { tenantId })
  },

  /**
   * Create a new tenant organization workspace
   * Endpoint: POST /v1/auth/tenants
   */
  async createTenant(tenantName: string): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/v1/auth/tenants', { tenantName })
  },

  /**
   * Fetch all users visible in the current/target tenant
   * Endpoint: GET /v1/users
   */
  async getTenantUsers(tenantId?: number | string): Promise<TenantUser[]> {
    return apiClient.get<TenantUser[]>('/v1/users', {
      tenantId: tenantId ? String(tenantId) : undefined,
    })
  },

  /**
   * Create an invitation code for a tenant
   * Endpoint: POST /v1/auth/tenants/invites
   */
  async createTenantInvite(request: CreateTenantInviteRequest): Promise<TenantInviteResponse> {
    const numericTenantId =
      typeof request.tenantId === 'number'
        ? request.tenantId
        : parseInt(String(request.tenantId), 10) || 1
    const payload = {
      tenantId: numericTenantId,
      expiresInHours: request.expiresInHours,
      role: request.role,
    }
    const res = await apiClient.post<TenantInviteResponse>('/v1/auth/tenants/invites', payload)
    return {
      ...res,
      email: request.email,
    }
  },

  /**
   * Remove a member from a workspace
   * Endpoint: DELETE /v1/auth/tenants/{tenantId}/members/{memberUserId}
   */
  async removeTenantMember(
    tenantId: number | string,
    memberUserId: number | string,
  ): Promise<void> {
    return apiClient.del<void>(`/v1/auth/tenants/${tenantId}/members/${memberUserId}`)
  },

  /**
   * Directly create and attach a user to a tenant
   * Endpoint: POST /v1/users
   */
  async directAddUser(payload: DirectAddUserRequest): Promise<TenantUser> {
    return apiClient.post<TenantUser>('/v1/users', payload)
  },

  /**
   * Join a workspace using an invite code
   * Endpoint: POST /v1/auth/tenants/join
   */
  async joinTenant(inviteCode: string): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>('/v1/auth/tenants/join', { inviteCode })
  },
}
