import React from 'react'
import { NavLink } from 'react-router-dom'
import {
  X,
  LayoutDashboard,
  Receipt,
  Tags,
  ScanLine,
  Building,
  Settings,
  PiggyBank,
  CalendarClock,
} from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  const { activeTenant, currentRole, isAdmin } = useActiveTenant()

  if (!isOpen) return null

  const items = [
    { name: 'Dashboard', to: '/', icon: LayoutDashboard },
    { name: 'Expenses', to: '/expenses', icon: Receipt },
    { name: 'Budgets', to: '/budgets', icon: PiggyBank },
    { name: 'Subscriptions', to: '/subscriptions', icon: CalendarClock },
    { name: 'Categories', to: '/categories', icon: Tags },
    { name: 'Receipt Scanning', to: '/receipts', icon: ScanLine },
    { name: 'Tenant Management', to: '/tenants', icon: Building, adminOnly: true },
    { name: 'Settings', to: '/settings', icon: Settings },
  ]

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-3/4 max-w-xs bg-background p-6 shadow-2xl flex flex-col justify-between border-r border-border animate-in slide-in-from-left duration-200 overflow-y-auto custom-scrollbar">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between pb-6 border-b border-border/60">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                ₩
              </div>
              <span className="font-bold text-base tracking-tight">expense.wiki</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Active Tenant Context in Mobile Menu */}
          <div className="my-4 p-3 rounded-lg bg-muted/60 border border-border/60 text-xs">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                Current Tenant
              </span>
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {currentRole}
              </Badge>
            </div>
            <div className="font-semibold text-foreground truncate">
              {activeTenant.name}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {activeTenant.currency} • {activeTenant.locale}
            </div>
          </div>

          {/* Nav Links */}
          <nav className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )
                  }
                >
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </div>
                  {item.adminOnly && !isAdmin && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 opacity-70">
                      admin
                    </Badge>
                  )}
                </NavLink>
              )
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-border/60 text-[11px] text-muted-foreground text-center">
          Multi-tenant scaffold • Ready for backend API
        </div>
      </div>
    </div>
  )
}
