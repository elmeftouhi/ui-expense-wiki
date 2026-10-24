import React, { useState } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { MobileNav } from './MobileNav'
import { useActiveTenant } from '@/features/tenants'
import { useAuth } from '@/features/auth'

export const AppShell: React.FC = () => {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const { activeTenant, isSwitching } = useActiveTenant()
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg shadow-md animate-pulse">
            ₩
          </div>
          <p className="text-xs text-muted-foreground animate-pulse">Initializing workspace...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="flex min-h-screen bg-background font-sans text-foreground antialiased">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Drawer */}
      <MobileNav
        isOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0">
        <Header onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto relative">
          {/* Tenant Switching Overlay indicator */}
          {isSwitching && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[1px] z-30 flex items-center justify-center">
              <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-lg flex items-center gap-3">
                <span className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                <span className="text-xs font-medium text-foreground">
                  Switching workspace to {activeTenant.name}...
                </span>
              </div>
            </div>
          )}

          {/* Render Route Pages */}
          <Outlet />
        </main>
      </div>
    </div>
  )
}
