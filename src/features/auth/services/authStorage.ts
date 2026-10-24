import type { AuthUser } from '../types'

const TOKEN_KEY = 'expense_wiki_auth_token'
const USER_KEY = 'expense_wiki_auth_user'
const TENANT_ID_KEY = 'expense_wiki_selected_tenant_id'

export interface DecodedTokenPayload {
  sub?: string // email
  uid?: number | string
  tenantId?: number
  tenants?: number[]
  exp?: number
  iat?: number
}

/**
 * Safely decodes JWT payload without external library
 */
export function decodeJwtToken(token: string): DecodedTokenPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const base64Url = parts[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join(''),
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

export const authStorage = {
  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },

  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token)
    } catch {
      // storage quota or private browsing
    }
  },

  removeToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      // ignore
    }
  },

  getUser(): AuthUser | null {
    try {
      const data = localStorage.getItem(USER_KEY)
      return data ? JSON.parse(data) : null
    } catch {
      return null
    }
  },

  setUser(user: AuthUser): void {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } catch {
      // ignore
    }
  },

  removeUser(): void {
    try {
      localStorage.removeItem(USER_KEY)
    } catch {
      // ignore
    }
  },

  getSelectedTenantId(): number | null {
    try {
      const id = localStorage.getItem(TENANT_ID_KEY) || localStorage.getItem('expense_wiki_active_tenant_id')
      return id ? Number(id) : null
    } catch {
      return null
    }
  },

  setSelectedTenantId(tenantId: number): void {
    try {
      localStorage.setItem(TENANT_ID_KEY, String(tenantId))
      localStorage.setItem('expense_wiki_active_tenant_id', String(tenantId))
    } catch {
      // ignore
    }
  },

  clearAll(): void {
    try {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      localStorage.removeItem(TENANT_ID_KEY)
      localStorage.removeItem('expense_wiki_active_tenant_id')
    } catch {
      // ignore
    }
  },
}
