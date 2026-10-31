import { useContext, useEffect, useRef } from 'react'
import { TenantContext } from './context'
import type { TenantContextValue } from '../types'

/**
 * Hook to consume the active tenant context.
 */
export function useActiveTenant(): TenantContextValue {
  const context = useContext(TenantContext)
  if (!context) {
    throw new Error('useActiveTenant must be used within a <TenantProvider>')
  }
  return context
}

/**
 * Utility hook to automatically reset component-level state when tenant changes.
 */
export function useResetOnTenantChange(onReset: () => void): void {
  const { activeTenant } = useActiveTenant()
  const previousTenantIdRef = useRef(activeTenant.id)

  useEffect(() => {
    if (previousTenantIdRef.current === activeTenant.id) return
    previousTenantIdRef.current = activeTenant.id
    onReset()
  }, [activeTenant.id, onReset])
}
