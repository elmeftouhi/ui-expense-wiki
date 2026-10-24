import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Receipt,
  Tags,
  ScanLine,
  Building,
  Settings,
  ShieldCheck,
  ChevronRight,
  PiggyBank,
  CalendarClock,
} from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface NavItem {
  name: string
  to: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  adminOnly?: boolean
}

const PRIMARY_NAV_ITEMS: NavItem[] = [
  { name: 'Dashboard', to: '/', icon: LayoutDashboard },
  { name: 'Expenses', to: '/expenses', icon: Receipt },
  { name: 'Budgets', to: '/budgets', icon: PiggyBank },
  { name: 'Subscriptions', to: '/subscriptions', icon: CalendarClock },
  { name: 'Categories', to: '/categories', icon: Tags },
  { name: 'Receipt Scanning', to: '/receipts', icon: ScanLine },
]

const ADMIN_NAV_ITEMS: NavItem[] = [
  { name: 'Tenant Management', to: '/tenants', icon: Building, adminOnly: true },
  { name: 'Settings', to: '/settings', icon: Settings },
]

export const Sidebar: React.FC = () => {
  const { activeTenant, currentRole, isAdmin } = useActiveTenant()

  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col sticky top-0 h-screen h-dvh border-r border-border/80 bg-card/60 backdrop-blur-sm select-none z-30">
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center gap-3 px-6 border-b border-border/60">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm font-bold text-lg">
          ₩
        </div>
        <div className="flex flex-col">
          <span className="font-bold tracking-tight text-foreground text-sm">
            expense<span className="text-primary">.wiki</span>
          </span>
          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
            Multi-Tenant Platform
          </span>
        </div>
      </div>

      {/* Nav Content with independent scroll */}
      <div className="flex-1 min-h-0 flex flex-col justify-between p-4 overflow-y-auto overscroll-contain custom-scrollbar">
        <div className="space-y-6">
          {/* Main Expense Management Nav */}
          <div>
            <div className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Expense Operations
            </div>
            <nav className="space-y-1">
              {PRIMARY_NAV_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0 transition-transform group-hover:scale-105',
                              isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground',
                            )}
                          />
                          <span>{item.name}</span>
                        </div>
                        {isActive && <ChevronRight className="h-3 w-3 opacity-70" />}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </nav>
          </div>

          {/* Tenant Administration & Settings (Separated per requirements) */}
          <div>
            <div className="px-3 mb-2 flex items-center justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <span>Administration</span>
              <span className="text-[9px] lowercase font-normal opacity-70">separate scope</span>
            </div>
            <nav className="space-y-1">
              {ADMIN_NAV_ITEMS.map((item) => {
                const Icon = item.icon
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        'group flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all',
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-accent/80 hover:text-foreground',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className="flex items-center gap-2.5">
                          <Icon
                            className={cn(
                              'h-4 w-4 shrink-0 transition-transform group-hover:scale-105',
                              isActive ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground',
                            )}
                          />
                          <span>{item.name}</span>
                        </div>
                        {item.adminOnly && !isAdmin && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4 opacity-70">
                            admin
                          </Badge>
                        )}
                        {isActive && <ChevronRight className="h-3 w-3 opacity-70" />}
                      </>
                    )}
                  </NavLink>
                )
              })}
            </nav>
          </div>
        </div>

        {/* Active Context Card in Sidebar footer */}
        <div className="pt-4 border-t border-border/60 mt-6 shrink-0">
          <div className="p-3 rounded-lg bg-muted/50 border border-border/60 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                Active Tenant
              </span>
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {currentRole}
              </Badge>
            </div>
            <p className="font-semibold text-foreground truncate text-xs">
              {activeTenant.name}
            </p>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              <span>Currency: {activeTenant.currency}</span>
              <span>•</span>
              <span>{activeTenant.locale}</span>
            </div>
          </div>

          <div className="mt-3 text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1">
            <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            <span>Frontend Scaffold v0.1</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
