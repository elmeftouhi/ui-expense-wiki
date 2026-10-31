import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Menu,
  Settings,
  Building2,
  LogOut,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { TenantSwitcher, useActiveTenant } from '@/features/tenants'
import { HeaderSearch } from './HeaderSearch'
import { HeaderNotifications } from './HeaderNotifications'
import { useTheme, type ThemeMode } from './useTheme'
import { Avatar } from '@/components/ui/avatar'
import { useAuth } from '@/features/auth'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onOpenMobileNav: () => void
}

const THEME_OPTIONS: Array<{ value: ThemeMode; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'Auto', icon: Monitor },
]

export const Header: React.FC<HeaderProps> = ({ onOpenMobileNav }) => {
  const { user, logout } = useAuth()
  const { currentRole } = useActiveTenant()
  const { theme, setTheme, toggleLightDark } = useTheme()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = user
    ? user.displayedName ||
      (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email.split('@')[0])
    : 'User'
  const displayEmail = user?.email || 'user@expense.wiki'

  useEffect(() => {
    if (!isUserMenuOpen) return

    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isUserMenuOpen])

  const handleLogout = async () => {
    setIsUserMenuOpen(false)
    await logout()
  }

  return (
    <header className="sticky top-0 z-40 flex h-14 w-full items-center justify-between gap-2 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75 px-3 sm:px-6">
      {/* Left: Mobile Menu Trigger + Active Workspace Switcher */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <TenantSwitcher />
      </div>

      {/* Right: Search, Quick Theme Toggle, Notifications, Account Menu */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <HeaderSearch />

        <button
          type="button"
          onClick={toggleLightDark}
          className="hidden sm:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background hover:bg-accent/60 text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label="Toggle color theme"
          title="Toggle light or dark theme"
        >
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </button>

        <HeaderNotifications />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            id="user-menu-trigger"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className={cn(
              'flex h-9 items-center gap-2 rounded-full border border-border/70 bg-background p-1 lg:pr-2.5 hover:bg-accent/60 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring',
              isUserMenuOpen && 'bg-accent/70 ring-2 ring-ring/30',
            )}
            aria-label={`Account menu for ${displayName}`}
            aria-expanded={isUserMenuOpen}
            aria-haspopup="menu"
          >
            <Avatar name={displayName} size="sm" />
            <span className="hidden lg:inline max-w-[110px] truncate text-xs font-medium text-foreground">
              {displayName}
            </span>
          </button>

          {isUserMenuOpen && (
            <div
              role="menu"
              aria-label="Account menu"
              className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl z-50 animate-in fade-in-50 zoom-in-95 text-xs"
            >
              <div className="px-2.5 py-2 border-b border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-foreground text-xs truncate">{displayName}</p>
                  <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                    {currentRole.toLowerCase()}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                  {displayEmail}
                </p>
              </div>

              {/* Theme Switcher */}
              <div className="px-2.5 py-2 border-b border-border/60">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-medium text-muted-foreground">Appearance</span>
                  <div
                    role="group"
                    aria-label="Color theme"
                    className="inline-flex items-center rounded-lg bg-muted/70 p-0.5 border border-border/60"
                  >
                    {THEME_OPTIONS.map((option) => {
                      const Icon = option.icon
                      const active = theme === option.value
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setTheme(option.value)}
                          aria-pressed={active}
                          title={`${option.label} theme`}
                          className={cn(
                            'inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium transition-colors cursor-pointer',
                            active
                              ? 'bg-background text-foreground shadow-xs'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          <Icon className="h-3 w-3" />
                          <span>{option.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              <div className="py-1 space-y-0.5">
                <Link
                  to="/settings"
                  role="menuitem"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-accent text-foreground text-xs transition-colors cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Workspace settings</span>
                </Link>

                <Link
                  to="/tenants"
                  role="menuitem"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-accent text-foreground text-xs transition-colors cursor-pointer"
                >
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Manage workspaces</span>
                </Link>
              </div>

              <div className="my-1 border-t border-border/60" />

              <button
                type="button"
                id="user-logout-button"
                role="menuitem"
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 text-xs font-medium transition-colors cursor-pointer text-left"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
