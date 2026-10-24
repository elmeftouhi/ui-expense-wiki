/**
 * Multi-tenant domain models, membership representations, and tenant-scoped roles.
 *
 * NOTE: Frontend role checks are strictly for UI presentation (hiding buttons, disabling inputs).
 * True authorization, access control, and isolation MUST be enforced securely by the backend.
 */

export type TenantRole = 'ADMIN' | 'EDITOR' | 'VIEWER'

export interface Tenant {
  id: number | string
  name: string
  slug: string
  logo?: string
  currency: string
  locale: string
  status: 'ACTIVE' | 'SUSPENDED' | 'PROVISIONING'
  plan: 'FREE' | 'PRO' | 'ENTERPRISE'
  fiscalYearStartMonth: number // 1 to 12
  createdAt?: string
  userCount?: number
}

export interface TenantMembership {
  id: number | string
  tenantId: number | string
  tenantName: string
  role: TenantRole
  isDefault: boolean
}

export interface TenantUser {
  id: number | string
  email: string
  displayedName?: string
  firstName?: string
  lastName?: string
  phone?: string
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_VERIFICATION'
  role?: TenantRole
  defaultTenantId?: number
  defaultTenantName?: string
  globalRoles?: ('USER' | 'ADMIN')[]
  tenantMemberships?: {
    id: number | string
    name?: string
    isDefault?: boolean
    role?: TenantRole
  }[]
}

export interface CreateTenantInviteRequest {
  tenantId: number | string
  expiresInHours: number
  role: TenantRole
  email?: string
}

export interface TenantInviteResponse {
  inviteCode: string
  tenantId: number | string
  expiresAt: string
  role: TenantRole
  email?: string
}

export interface DirectAddUserRequest {
  email: string
  password: string
  firstName?: string
  lastName?: string
  phone?: string
  tenantAssignments: {
    tenantId: number
    role: TenantRole
  }[]
}

export interface TenantInvite {
  id: number | string
  email: string
  role: TenantRole
  invitedAt: string
  expiresAt: string
  status: 'PENDING' | 'ACCEPTED' | 'REVOKED'
}

export interface TenantContextValue {
  activeTenant: Tenant
  availableTenants: Tenant[]
  memberships: TenantMembership[]
  currentRole: TenantRole
  isSwitching: boolean
  switchTenant: (tenantId: number | string) => void
  /**
   * UI convenience check: evaluates role hierarchy (ADMIN > EDITOR > VIEWER).
   * Backend still strictly enforces all data mutations.
   */
  hasMinimumRole: (minRole: TenantRole) => boolean
  isAdmin: boolean
  canEdit: boolean
}
