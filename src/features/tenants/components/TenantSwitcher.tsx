import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { useActiveTenant } from '../context/useActiveTenant'
import { cn } from '@/lib/utils'

export const TenantSwitcher: React.FC = () => {
  const { activeTenant, availableTenants, switchTenant, isSwitching } = useActiveTenant()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  const initial = (activeTenant.name?.trim().charAt(0) || 'W').toUpperCase()

  return (
    <div className="relative min-w-0" ref={dropdownRef}>
      <button
        type="button"
        id="tenant-switcher-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isSwitching}
        className={cn(
          'flex h-9 max-w-full cursor-pointer items-center gap-2 rounded-lg border border-border/80 bg-background/80 px-2 text-left text-xs font-medium transition-colors hover:bg-accent/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-2.5',
          isOpen && 'border-ring/60 bg-accent/60',
          isSwitching && 'cursor-wait opacity-60',
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title="Switch workspace"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/12 text-[11px] font-bold text-primary">
          {initial}
        </span>

        <span className="max-w-[110px] truncate font-semibold text-foreground sm:max-w-[160px] md:max-w-[200px]">
          {activeTenant.name}
        </span>

        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
          {activeTenant.currency}
          <span className="hidden md:inline"> · {activeTenant.locale}</span>
        </span>

        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Workspaces"
          className="fixed inset-x-3 top-15 z-50 rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-2xl animate-in fade-in-50 zoom-in-95 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-1.5 sm:w-72 sm:max-w-[calc(100vw-2rem)] sm:shadow-xl"
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Workspaces
          </div>

          <div className="max-h-64 space-y-0.5 overflow-y-auto custom-scrollbar">
            {availableTenants.map((tenant) => {
              const isSelected = String(tenant.id) === String(activeTenant.id)
              return (
                <button
                  key={tenant.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    if (!isSelected) switchTenant(tenant.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors',
                    isSelected
                      ? 'bg-primary/10 font-semibold text-foreground'
                      : 'text-foreground hover:bg-accent/60',
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <span
                      className={cn(
                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px]',
                        isSelected
                          ? 'bg-primary font-bold text-primary-foreground'
                          : 'bg-muted font-medium text-muted-foreground',
                      )}
                    >
                      {tenant.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{tenant.name}</p>
                      {isSelected && (
                        <p className="font-mono text-[10px] text-muted-foreground">
                          {activeTenant.currency} · {activeTenant.locale}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              )
            })}
          </div>

          <div className="mt-1 border-t border-border/60 pt-1">
            <Link
              to="/tenants"
              onClick={() => setIsOpen(false)}
              className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span>Manage workspaces</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
