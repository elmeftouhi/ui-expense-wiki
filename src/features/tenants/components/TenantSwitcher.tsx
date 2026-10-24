import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Building2, Check, ChevronDown, Plus } from 'lucide-react'
import { useActiveTenant } from '../context/useActiveTenant'
import { cn } from '@/lib/utils'

export const TenantSwitcher: React.FC = () => {
  const { activeTenant, availableTenants, switchTenant, isSwitching } =
    useActiveTenant()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        id="tenant-switcher-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        disabled={isSwitching}
        className={cn(
          'flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-border/80 bg-background/80 hover:bg-accent/60 transition-all text-left text-sm font-medium shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
          isSwitching && 'opacity-60 cursor-wait',
        )}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        title="Switch Organization"
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10 text-primary border border-primary/20 shrink-0">
          <Building2 className="w-4 h-4" />
        </div>

        <div className="flex flex-col min-w-0 pr-1">
          <span className="truncate max-w-[95px] xs:max-w-[140px] sm:max-w-[180px] md:max-w-[220px] text-xs font-semibold text-foreground">
            {activeTenant.name}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span>{activeTenant.currency}</span>
            <span>•</span>
            <span>{activeTenant.locale}</span>
          </div>
        </div>

        <ChevronDown
          className={cn(
            'w-4 h-4 text-muted-foreground transition-transform duration-200 ml-0.5 shrink-0',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label="Workspaces"
          className="fixed inset-x-3 top-17 z-50 rounded-xl border border-border bg-card p-1.5 text-card-foreground shadow-2xl animate-in fade-in-50 zoom-in-95 sm:absolute sm:inset-x-auto sm:left-0 sm:top-full sm:mt-1.5 sm:w-80 sm:max-w-[calc(100vw-2rem)] sm:shadow-xl"
        >
          {/* Section Header */}
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">
            Workspaces
          </div>

          {/* Tenants List */}
          <div className="space-y-0.5">
            {availableTenants.map((tenant) => {
              const isSelected = String(tenant.id) === String(activeTenant.id)

              return (
                <button
                  key={tenant.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    switchTenant(tenant.id)
                    setIsOpen(false)
                  }}
                  className={cn(
                    'w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors cursor-pointer text-left',
                    isSelected
                      ? 'bg-accent text-accent-foreground font-semibold'
                      : 'hover:bg-accent/60 text-foreground',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div
                      className={cn(
                        'w-6 h-6 rounded flex items-center justify-center text-xs shrink-0',
                        isSelected
                          ? 'bg-primary text-primary-foreground font-bold'
                          : 'bg-muted text-muted-foreground font-medium',
                      )}
                    >
                      {tenant.name.charAt(0)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{tenant.name}</p>
                      {isSelected && (
                        <p className="text-[10px] text-muted-foreground">
                          {activeTenant.currency} • {activeTenant.locale}
                        </p>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="w-4 h-4 text-primary shrink-0" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Link to create a new tenant */}
          <div className="mt-1 pt-1 border-t border-border/60">
            <Link
              to="/tenants"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              <div className="w-5 h-5 rounded-md border border-dashed border-primary/50 flex items-center justify-center text-primary shrink-0">
                <Plus className="w-3.5 h-3.5" />
              </div>
              <span>Create organization</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
