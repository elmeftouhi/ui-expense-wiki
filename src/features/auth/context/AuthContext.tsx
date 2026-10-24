import React, { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiClientError } from '@/api/client'
import type {
  AuthUser,
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  CurrentUserResponse,
} from '../types'
import { authService } from '../services/authService'
import { authStorage, decodeJwtToken } from '../services/authStorage'
import { AuthContext } from './context'

/**
 * Fetch /v1/me and, if the backend remembers a different last-used tenant
 * (currentTenantId) than the one in the given token, switch to it so the user
 * resumes where they left off. Never throws: falls back to the original response.
 */
async function restoreLastTenant(
  response: AuthResponse,
): Promise<{ response: AuthResponse; me: CurrentUserResponse | null }> {
  let me: CurrentUserResponse
  try {
    me = await authService.getMe()
  } catch {
    return { response, me: null }
  }

  const targetId = me.currentTenantId
  const allowed = response.allowedTenantIds ?? []
  const canSwitch =
    targetId != null &&
    targetId !== response.selectedTenantId &&
    (allowed.length === 0 || allowed.includes(targetId))

  if (!canSwitch) return { response, me }

  try {
    const switched = await authService.switchTenant(targetId)
    return { response: switched, me }
  } catch {
    return { response, me }
  }
}

function buildUser(
  response: AuthResponse,
  me: CurrentUserResponse | null,
  fallback: Partial<AuthUser> = {},
): AuthUser {
  const decoded = decodeJwtToken(response.accessToken)
  return {
    ...fallback,
    id: me?.id ?? decoded?.uid ?? fallback.id ?? response.selectedTenantId,
    email: me?.email ?? fallback.email ?? decoded?.sub ?? 'user@expense.wiki',
    displayedName: me?.displayedName ?? fallback.displayedName,
    firstName: me?.firstName ?? fallback.firstName,
    lastName: me?.lastName ?? fallback.lastName,
    phone: me?.phone ?? fallback.phone,
    status: me?.status ?? fallback.status,
    defaultTenantId: me?.defaultTenantId ?? fallback.defaultTenantId,
    currentTenantId: response.selectedTenantId,
    roles: me?.roles ?? fallback.roles ?? ['USER'],
    selectedTenantId: response.selectedTenantId,
    allowedTenantIds: response.allowedTenantIds ?? fallback.allowedTenantIds,
  }
}

interface InitialAuthState {
  token: string | null
  user: AuthUser | null
  selectedTenantId: number | null
  allowedTenantIds: number[]
}

function getInitialAuthState(): InitialAuthState {
  const existingToken = authStorage.getToken()
  if (!existingToken) {
    return { token: null, user: null, selectedTenantId: null, allowedTenantIds: [] }
  }

  const decoded = decodeJwtToken(existingToken)
  if (decoded && (decoded.exp === undefined || decoded.exp * 1000 > Date.now())) {
    const storedUser = authStorage.getUser()
    const userObj: AuthUser = storedUser ?? {
      id: decoded.uid ?? 1,
      email: decoded.sub ?? 'user@expense.wiki',
      roles: ['USER'],
      selectedTenantId: decoded.tenantId,
      allowedTenantIds: decoded.tenants,
    }
    return {
      token: existingToken,
      user: userObj,
      selectedTenantId: decoded.tenantId ?? null,
      allowedTenantIds: decoded.tenants ?? [],
    }
  }

  // Token expired or invalid
  authStorage.clearAll()
  return { token: null, user: null, selectedTenantId: null, allowedTenantIds: [] }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [initial] = useState<InitialAuthState>(getInitialAuthState)
  const [token, setToken] = useState<string | null>(initial.token)
  const [user, setUser] = useState<AuthUser | null>(initial.user)
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(initial.selectedTenantId)
  const [allowedTenantIds, setAllowedTenantIds] = useState<number[]>(initial.allowedTenantIds)
  const [isLoading, setIsLoading] = useState(false)
  const queryClient = useQueryClient()

  const clearSession = useCallback(() => {
    authStorage.clearAll()
    setToken(null)
    setUser(null)
    setSelectedTenantId(null)
    setAllowedTenantIds([])
    queryClient.clear()
  }, [queryClient])

  // On app start with an existing session, refresh profile from /v1/me and
  // make sure we are on the backend's last-used tenant.
  useEffect(() => {
    if (!initial.token) return
    let cancelled = false

    const sync = async () => {
      const decoded = decodeJwtToken(initial.token as string)
      const current: AuthResponse = {
        accessToken: initial.token as string,
        tokenType: 'Bearer',
        expiresInMinutes: 0,
        selectedTenantId: initial.selectedTenantId ?? decoded?.tenantId ?? 0,
        allowedTenantIds: initial.allowedTenantIds,
      }
      const { response, me } = await restoreLastTenant(current)
      if (cancelled || authStorage.getToken() !== current.accessToken) return

      const switched = response.accessToken !== current.accessToken
      if (switched) {
        setToken(response.accessToken)
        setSelectedTenantId(response.selectedTenantId)
        setAllowedTenantIds(response.allowedTenantIds ?? [])
        // Drop any data fetched under the previous tenant
        queryClient.removeQueries()
      }
      if (me || switched) {
        const updated = buildUser(response, me, initial.user ?? {})
        setUser(updated)
        authStorage.setUser(updated)
      }
    }

    void sync()
    return () => {
      cancelled = true
    }
  }, [initial, queryClient])

  // Listen for unauthorized 401 events and logout triggers
  useEffect(() => {
    const handleUnauthorized = () => {
      clearSession()
    }

    const handleLogoutEvent = () => {
      void authService.logout().finally(clearSession)
    }

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'expense_wiki_auth_token' && event.newValue === null) {
        clearSession()
      }
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    window.addEventListener('user-logout', handleLogoutEvent)
    window.addEventListener('storage', handleStorageChange)
    return () => {
      window.removeEventListener('auth:unauthorized', handleUnauthorized)
      window.removeEventListener('user-logout', handleLogoutEvent)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [clearSession])

  useEffect(() => {
    if (!token) return
    let checking = false

    const checkSession = async () => {
      if (checking || document.visibilityState === 'hidden') return
      checking = true
      try {
        await authService.getMe()
      } catch (error) {
        if (error instanceof ApiClientError && error.status === 401) {
          clearSession()
        }
      } finally {
        checking = false
      }
    }

    const checkOnFocus = () => {
      if (document.visibilityState !== 'hidden') void checkSession()
    }
    const intervalId = window.setInterval(() => void checkSession(), 60_000)
    window.addEventListener('focus', checkOnFocus)
    document.addEventListener('visibilitychange', checkOnFocus)

    const decoded = decodeJwtToken(token)
    const expiresIn = decoded?.exp !== undefined ? decoded.exp * 1000 - Date.now() : null
    const expiryTimeout = expiresIn === null || expiresIn > 2_147_483_647
      ? undefined
      : window.setTimeout(clearSession, Math.max(0, expiresIn))

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', checkOnFocus)
      document.removeEventListener('visibilitychange', checkOnFocus)
      if (expiryTimeout !== undefined) window.clearTimeout(expiryTimeout)
    }
  }, [token, clearSession])

  const login = useCallback(async (credentials: LoginRequest): Promise<AuthResponse> => {
    setIsLoading(true)
    try {
      const loginResponse = await authService.login(credentials)

      // Resume the tenant the user was last working on (persisted by the backend)
      const { response, me } = await restoreLastTenant(loginResponse)

      setToken(response.accessToken)
      setSelectedTenantId(response.selectedTenantId)
      setAllowedTenantIds(response.allowedTenantIds ?? [])

      const userObj = buildUser(response, me, { email: credentials.email })
      setUser(userObj)
      authStorage.setUser(userObj)

      return response
    } finally {
      setIsLoading(false)
    }
  }, [])

  const register = useCallback(async (payload: RegisterRequest): Promise<AuthResponse> => {
    setIsLoading(true)
    try {
      const response = await authService.register(payload)
      setToken(response.accessToken)
      setSelectedTenantId(response.selectedTenantId)
      setAllowedTenantIds(response.allowedTenantIds ?? [])

      // Construct user profile
      const decoded = decodeJwtToken(response.accessToken)
      const userObj: AuthUser = {
        id: decoded?.uid ?? response.selectedTenantId,
        email: payload.email,
        firstName: payload.firstName,
        lastName: payload.lastName,
        tenantName: payload.tenantName,
        roles: ['ADMIN'],
        selectedTenantId: response.selectedTenantId,
        allowedTenantIds: response.allowedTenantIds,
      }
      setUser(userObj)
      authStorage.setUser(userObj)

      return response
    } finally {
      setIsLoading(false)
    }
  }, [])

  const setSessionFromAuth = useCallback((response: AuthResponse) => {
    setToken(response.accessToken)
    setSelectedTenantId(response.selectedTenantId)
    setAllowedTenantIds(response.allowedTenantIds ?? [])

    const decoded = decodeJwtToken(response.accessToken)
    setUser((prev) => {
      const updated: AuthUser = {
        id: decoded?.uid ?? prev?.id ?? response.selectedTenantId,
        email: decoded?.sub ?? prev?.email ?? 'user@expense.wiki',
        firstName: prev?.firstName,
        lastName: prev?.lastName,
        tenantName: prev?.tenantName,
        roles: prev?.roles ?? ['ADMIN'],
        selectedTenantId: response.selectedTenantId,
        allowedTenantIds: response.allowedTenantIds ?? prev?.allowedTenantIds,
      }
      authStorage.setUser(updated)
      return updated
    })
  }, [])

  const switchTenant = useCallback(
    async (tenantId: number): Promise<AuthResponse> => {
      setIsLoading(true)
      try {
        const response = await authService.switchTenant(tenantId)
        setSessionFromAuth(response)
        return response
      } finally {
        setIsLoading(false)
      }
    },
    [setSessionFromAuth],
  )

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true)
    try {
      await authService.logout()
    } finally {
      clearSession()
      setIsLoading(false)
    }
  }, [clearSession])

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated: !!token,
        user,
        token,
        selectedTenantId,
        allowedTenantIds,
        isLoading,
        login,
        register,
        logout,
        switchTenant,
        setSessionFromAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
