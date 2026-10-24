import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Menu, User, Settings, LogOut } from 'lucide-react'
import { TenantSwitcher } from '@/features/tenants'
import { HeaderSearch } from './HeaderSearch'
import { HeaderNotifications } from './HeaderNotifications'
import { Avatar } from '@/components/ui/avatar'
import { useAuth } from '@/features/auth'

interface HeaderProps {
  onOpenMobileNav: () => void
}

export const Header: React.FC<HeaderProps> = ({ onOpenMobileNav }) => {
  const { user, logout } = useAuth()
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const displayName = user
    ? user.displayedName ||
      (user.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : user.email.split('@')[0])
    : 'User'
  const displayEmail = user?.email || 'user@expense.wiki'

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    setIsUserMenuOpen(false)
    await logout()
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-3 sm:px-6">
      {/* Left: Mobile Menu Trigger, Mobile Brand, and Selected Tenant Switcher */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="lg:hidden flex items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:flex lg:hidden items-center gap-2 shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
            ₩
          </div>
          <span className="font-bold text-sm tracking-tight">expense.wiki</span>
        </div>

        {/* Selected Tenant Section on the left */}
        <TenantSwitcher />
      </div>

      {/* Right: Search Icon, Notifications, and User Menu */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* 1. Search Icon with Search History */}
        <HeaderSearch />

        {/* 2. Notifications Icon with Unread Badge & Dropdown */}
        <HeaderNotifications />

        {/* 3. User Dropdown Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            id="user-menu-trigger"
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full border border-border/60 hover:bg-accent/60 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring"
            aria-expanded={isUserMenuOpen}
            aria-haspopup="menu"
            title="User Profile and Session"
          >
            <Avatar name={displayName} size="sm" />
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold leading-none text-foreground">
                {displayName}
              </span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                {displayEmail}
              </span>
            </div>
          </button>

          {isUserMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-xl z-50 animate-in fade-in-50 zoom-in-95 text-xs"
            >
              {/* User Info Header (clean, no extra labels, no role) */}
              <div className="px-3 py-2 border-b border-border/60">
                <p className="font-semibold text-foreground text-xs leading-none">{displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate mt-1">
                  {displayEmail}
                </p>
              </div>

              {/* Navigation Actions */}
              <div className="py-1 space-y-0.5">
                <Link
                  to="/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-accent text-foreground text-xs transition-colors cursor-pointer"
                >
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Account Profile</span>
                </Link>

                <Link
                  to="/settings"
                  onClick={() => setIsUserMenuOpen(false)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-accent text-foreground text-xs transition-colors cursor-pointer"
                >
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>Preferences</span>
                </Link>
              </div>

              {/* Divider */}
              <div className="my-1 border-t border-border/60" />

              {/* Action to Log Out */}
              <button
                type="button"
                id="user-logout-button"
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
