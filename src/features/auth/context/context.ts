import { createContext } from 'react'
import type { AuthUser, LoginRequest, RegisterRequest, AuthResponse } from '../types'

export interface AuthContextValue {
  isAuthenticated: boolean
  user: AuthUser | null
  token: string | null
  selectedTenantId: number | null
  allowedTenantIds: number[]
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<AuthResponse>
  register: (payload: RegisterRequest) => Promise<AuthResponse>
  logout: () => Promise<void>
  switchTenant: (tenantId: number) => Promise<AuthResponse>
  setSessionFromAuth: (response: AuthResponse) => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)
