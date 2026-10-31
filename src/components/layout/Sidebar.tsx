import React from 'react'
import { Link, NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { cn } from '@/lib/utils'
import {
  PRIMARY_NAV_ITEMS,
  WORKSPACE_NAV_ITEMS,
  type AppNavItem,
} from './navigationConfig'

interface SidebarProps {
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
}) => {
  const { isAdmin } = useActiveTenant()

  const renderNavItem = (item: AppNavItem) => {
    const Icon = item.icon
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === '/'}
        title={collapsed ? item.name : undefined}
        aria-label={collapsed ? item.name : undefined}
        className={({ isActive }) =>
          cn(
            'group relative flex items-center rounded-lg text-[13px] transition-colors',
            collapsed
              ? 'h-9 w-9 mx-auto justify-center'
              : 'min-h-9 justify-between px-2.5 py-1.5',
            isActive
              ? 'bg-primary/10 text-primary font-semibold dark:bg-primary/15'
              : 'text-muted-foreground font-medium hover:bg-muted/70 hover:text-foreground',
          )
        }
      >
        {({ isActive }) => (
          <>
            <span className={cn('flex items-center min-w-0', !collapsed && 'gap-2.5')}>
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground group-hover:text-foreground',
                )}
              />
              {!collapsed && <span className="truncate">{item.name}</span>}
            </span>

            {!collapsed && item.adminOnly && !isAdmin && (
              <span className="rounded border border-border/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Admin
              </span>
            )}
          </>
        )}
      </NavLink>
    )
  }

  return (
    <aside
      aria-label="Primary navigation"
      className={cn(
        'hidden lg:flex shrink-0 flex-col sticky top-0 h-screen h-dvh border-r border-border/70 bg-card/40 select-none z-30 transition-[width] duration-200 ease-out',
        collapsed ? 'w-16' : 'w-60',
      )}
    >
      {/* Brand Header (matches h-14 top Header) */}
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-border/70',
          collapsed ? 'justify-center px-2' : 'justify-between px-4',
        )}
      >
        <Link
          to="/"
          className="flex items-center gap-2.5 min-w-0 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="expense.wiki home"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm shadow-xs">
            ₩
          </div>
          {!collapsed && (
            <span className="font-bold tracking-tight text-foreground text-sm truncate">
              expense<span className="text-primary">.wiki</span>
            </span>
          )}
        </Link>
      </div>

      {/* Navigation Links */}
      <div
        className={cn(
          'flex-1 min-h-0 overflow-y-auto overscroll-contain custom-scrollbar py-3',
          collapsed ? 'px-2' : 'px-3',
        )}
      >
        <nav aria-label="Main sections" className="space-y-0.5">
          {PRIMARY_NAV_ITEMS.map(renderNavItem)}
        </nav>

        <div className="my-3 border-t border-border/60" />

        {!collapsed && (
          <div className="px-2.5 mb-1.5 text-[11px] font-medium text-muted-foreground">
            Workspace
          </div>
        )}

        <nav aria-label="Workspace sections" className="space-y-0.5">
          {WORKSPACE_NAV_ITEMS.map(renderNavItem)}
        </nav>
      </div>

      {/* Collapse / Expand Rail Control */}
      {onToggleCollapse && (
        <div className="shrink-0 border-t border-border/60 p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex items-center rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring',
              collapsed ? 'h-9 w-9 mx-auto justify-center' : 'h-9 w-full gap-2.5 px-2.5',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4 shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </aside>
  )
}
