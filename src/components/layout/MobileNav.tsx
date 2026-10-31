import React, { useEffect } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { cn } from '@/lib/utils'
import {
  PRIMARY_NAV_ITEMS,
  WORKSPACE_NAV_ITEMS,
  type AppNavItem,
} from './navigationConfig'

interface MobileNavProps {
  isOpen: boolean
  onClose: () => void
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  const { isAdmin } = useActiveTenant()

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const renderItem = (item: AppNavItem) => {
    const Icon = item.icon
    return (
      <NavLink
        key={item.to}
        to={item.to}
        end={item.to === '/'}
        onClick={onClose}
        className={({ isActive }) =>
          cn(
            'flex min-h-10 items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
            isActive
              ? 'bg-primary/10 text-primary font-semibold dark:bg-primary/15'
              : 'text-muted-foreground font-medium hover:bg-muted/70 hover:text-foreground',
          )
        }
      >
        {({ isActive }) => (
          <>
            <span className="flex items-center gap-3 min-w-0">
              <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
              <span className="truncate">{item.name}</span>
            </span>
            {item.adminOnly && !isAdmin && (
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Navigation menu"
      className="fixed inset-0 z-50 lg:hidden"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/55 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 max-w-[82vw] bg-background shadow-2xl flex flex-col border-r border-border animate-in slide-in-from-left duration-200">
        {/* Brand Header (matches h-14 top Header) */}
        <div className="flex h-14 shrink-0 items-center justify-between px-4 border-b border-border/70">
          <Link
            to="/"
            onClick={onClose}
            className="flex items-center gap-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              ₩
            </div>
            <span className="font-bold text-sm tracking-tight text-foreground">
              expense<span className="text-primary">.wiki</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors cursor-pointer"
            aria-label="Close navigation menu"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar p-3">
          <nav aria-label="Mobile main navigation" className="space-y-0.5">
            {PRIMARY_NAV_ITEMS.map(renderItem)}
          </nav>

          <div className="my-3 border-t border-border/60" />

          <div className="px-3 mb-1.5 text-[11px] font-medium text-muted-foreground">
            Workspace
          </div>

          <nav aria-label="Mobile workspace navigation" className="space-y-0.5">
            {WORKSPACE_NAV_ITEMS.map(renderItem)}
          </nav>
        </div>
      </div>
    </div>
  )
}
