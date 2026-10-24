import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import type { Tenant, TenantMembership, TenantRole, TenantContextValue } from '../types'
import { DEMO_TENANTS, DEMO_MEMBERSHIPS } from '../data/demo-tenants'
import { TenantContext } from './context'
import { useAuth } from '@/features/auth'
import { tenantService } from '../services/tenantService'
import { useConfiguration } from '@/features/settings/hooks/useConfiguration'
import { getApiErrorMessage } from '@/lib/api-error'
import { Button } from '@/components/ui/button'

const ROLE_HIERARCHY: Record<TenantRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
}

const STORAGE_KEY = 'expense_wiki_active_tenant_id'

interface TenantProviderProps {
  children: React.ReactNode
  initialTenantId?: number | string
}

export const TenantProvider: React.FC<TenantProviderProps> = ({
  children,
  initialTenantId,
}) => {
  const queryClient = useQueryClient()
  const { user, selectedTenantId, switchTenant: authSwitchTenant, isAuthenticated } = useAuth()

  // Fetch real tenants from backend when authenticated
  const { data: backendMemberships = [], isPending: isTenantsPending } = useQuery({
    queryKey: ['my-tenants', user?.id],
    queryFn: () => tenantService.getMyTenants(),
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5,
  })

  // True while an authenticated user's real tenants haven't arrived yet.
  // Used to avoid briefly rendering DEMO tenants on page reload.
  const isLoadingTenants = isAuthenticated && isTenantsPending

  // Map backend memberships to Tenant domain models
  const availableTenants = useMemo<Tenant[]>(() => {
    if (backendMemberships.length > 0) {
      return backendMemberships.map((m) => ({
        id: m.id,
        name: m.name,
        slug: m.name.toLowerCase().replace(/\s+/g, '-'),
        currency: 'USD',
        locale: 'en-US',
        status: 'ACTIVE',
        plan: 'PRO',
        fiscalYearStartMonth: 1,
      }))
    }
    return DEMO_TENANTS
  }, [backendMemberships])

  const memberships = useMemo<TenantMembership[]>(() => {
    if (backendMemberships.length > 0) {
      return backendMemberships.map((m) => ({
        id: m.id,
        tenantId: m.id,
        tenantName: m.name,
        role: m.role,
        isDefault: m.isDefault,
      }))
    }
    return DEMO_MEMBERSHIPS
  }, [backendMemberships])

  // Initialize active tenant from session or localStorage
  const [activeTenantId, setActiveTenantId] = useState<number | string>(() => {
    if (initialTenantId) return initialTenantId
    if (selectedTenantId) return selectedTenantId
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return isNaN(Number(saved)) ? saved : Number(saved)
    } catch {
      // ignore
    }
    return DEMO_TENANTS[0].id
  })

  const [isSwitching, setIsSwitching] = useState<boolean>(false)

  // Current active tenant
  const activeTenant = useMemo<Tenant>(() => {
    if (selectedTenantId) {
      const found = availableTenants.find((t) => t.id === selectedTenantId)
      if (found) return found
    }
    const found = availableTenants.find((t) => String(t.id) === String(activeTenantId))
    if (found) return found
    return availableTenants[0] || DEMO_TENANTS[0]
  }, [availableTenants, selectedTenantId, activeTenantId])

  const shouldLoadConfiguration = isAuthenticated && !isLoadingTenants && backendMemberships.length > 0
  const configuration = useConfiguration(activeTenant.id, shouldLoadConfiguration)
  const configuredActiveTenant = useMemo<Tenant>(() => ({
    ...activeTenant,
    currency: shouldLoadConfiguration && configuration.data
      ? configuration.data.currency
      : activeTenant.currency,
    locale: shouldLoadConfiguration && configuration.data
      ? configuration.data.language.toLowerCase()
      : activeTenant.locale,
  }), [activeTenant, shouldLoadConfiguration, configuration.data])
  const configuredAvailableTenants = useMemo(
    () => availableTenants.map((tenant) =>
      String(tenant.id) === String(configuredActiveTenant.id) ? configuredActiveTenant : tenant,
    ),
    [availableTenants, configuredActiveTenant],
  )

  const currentMembership = useMemo<TenantMembership | undefined>(() => {
    return memberships.find((m) => String(m.tenantId) === String(activeTenant.id))
  }, [memberships, activeTenant.id])

  const currentRole: TenantRole = currentMembership?.role ?? 'ADMIN'

  /**
   * Switch the active tenant.
   * Calls POST /v1/auth/switch-tenant on backend, updates JWT token,
   * clears all TanStack Query caches to guarantee strict data segregation.
   */
  const switchTenant = useCallback(
    async (newTenantId: number | string) => {
      const target = availableTenants.find((t) => String(t.id) === String(newTenantId))
      if (!target || String(target.id) === String(activeTenant.id)) return

      setIsSwitching(true)

      try {
        // If numeric tenant ID, call backend to re-issue JWT token with new tenantId
        const numericId = typeof target.id === 'number' ? target.id : parseInt(String(target.id), 10)
        if (!isNaN(numericId) && isAuthenticated) {
          await authSwitchTenant(numericId)
        }

        try {
          localStorage.setItem(STORAGE_KEY, String(target.id))
        } catch {
          // ignore
        }

        setActiveTenantId(target.id)

        // Clear all queries (categories, expenses, budgets, etc.) to prevent data bleeding
        queryClient.removeQueries()

        // Dispatch custom event for UI components holding transient filters/inputs
        window.dispatchEvent(
          new CustomEvent('tenant-switched', {
            detail: {
              previousTenantId: activeTenant.id,
              newTenantId: target.id,
            },
          }),
        )
      } finally {
        setTimeout(() => {
          setIsSwitching(false)
        }, 150)
      }
    },
    [availableTenants, activeTenant.id, isAuthenticated, authSwitchTenant, queryClient],
  )

  const hasMinimumRole = useCallback(
    (minRole: TenantRole): boolean => {
      return ROLE_HIERARCHY[currentRole] >= ROLE_HIERARCHY[minRole]
    },
    [currentRole],
  )

  const isAdmin = currentRole === 'ADMIN'
  const canEdit = hasMinimumRole('EDITOR')

  useEffect(() => {
    if (isLoadingTenants) return
    document.title = `${activeTenant.name} — Expense Wiki`
  }, [activeTenant.name, isLoadingTenants])

  const contextValue = useMemo<TenantContextValue>(
    () => ({
      activeTenant: configuredActiveTenant,
      availableTenants: configuredAvailableTenants,
      memberships,
      currentRole,
      isSwitching,
      switchTenant,
      hasMinimumRole,
      isAdmin,
      canEdit,
    }),
    [
      configuredActiveTenant,
      configuredAvailableTenants,
      memberships,
      currentRole,
      isSwitching,
      switchTenant,
      hasMinimumRole,
      isAdmin,
      canEdit,
    ],
  )

  if (isLoadingTenants || (shouldLoadConfiguration && configuration.isPending)) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen w-full flex flex-col items-center justify-center gap-3 bg-background text-muted-foreground"
      >
        <span className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs">Loading your workspace…</span>
      </div>
    )
  }

  if (shouldLoadConfiguration && configuration.isError && !configuration.data) {
    return (
      <div role="alert" className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-sm text-destructive">Unable to load workspace settings: {getApiErrorMessage(configuration.error)}</p>
        <Button disabled={configuration.isFetching} onClick={() => void configuration.refetch()}>
          Reload workspace settings
        </Button>
      </div>
    )
  }

  return (
    <TenantContext.Provider value={contextValue}>
      {children}
    </TenantContext.Provider>
  )
}
