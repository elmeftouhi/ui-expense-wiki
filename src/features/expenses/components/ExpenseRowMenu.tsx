import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { MoreHorizontal } from 'lucide-react'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'

export type RowMenuItem =
  | { key: string; label: string; icon: ReactNode; to: string; state?: unknown; destructive?: boolean }
  | { key: string; label: string; icon: ReactNode; onSelect: () => void; destructive?: boolean }

const MENU_WIDTH = 184

export function ExpenseRowMenu({
  label,
  title,
  items,
}: {
  label: string
  title?: string
  items: RowMenuItem[]
}) {
  const isDesktop = useMediaQuery('(min-width: 768px)', true)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; placement: 'below' | 'above' } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const sheetWrapperRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  const close = (restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const openMenu = () => {
    if (!triggerRef.current) return
    if (isDesktop) {
      const rect = triggerRef.current.getBoundingClientRect()
      const estimatedHeight = items.length * 36 + 8
      const placement = window.innerHeight - rect.bottom < estimatedHeight && rect.top > estimatedHeight ? 'above' : 'below'
      const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
      setPosition({ top: placement === 'below' ? rect.bottom + 4 : rect.top - 4, left, placement })
    } else {
      setPosition({ top: 0, left: 0, placement: 'below' })
    }
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()

    if (!isDesktop) {
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = previousOverflow
      }
    }

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const onViewportChange = () => setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [open, isDesktop])

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const entries = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const index = entries.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    } else if (event.key === 'Tab') {
      setOpen(false)
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      entries[(index + step + entries.length) % entries.length]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      entries[event.key === 'Home' ? 0 : entries.length - 1]?.focus()
    }
  }

  const itemClass = (destructive?: boolean) => cn(
    'flex w-full items-center gap-2.5 rounded-lg text-left text-sm outline-none transition-colors focus-visible:bg-accent hover:bg-accent',
    isDesktop ? 'px-2.5 py-2' : 'min-h-11 px-3.5 py-2.5 font-medium',
    destructive ? 'text-destructive focus-visible:bg-destructive/10 hover:bg-destructive/10' : 'text-foreground',
  )

  const renderMenuItems = () =>
    items.map((item) =>
      'to' in item ? (
        <Link
          key={item.key}
          role="menuitem"
          tabIndex={-1}
          to={item.to}
          state={item.state}
          onClick={() => setOpen(false)}
          className={itemClass(item.destructive)}
        >
          {item.icon}
          {item.label}
        </Link>
      ) : (
        <button
          key={item.key}
          type="button"
          role="menuitem"
          tabIndex={-1}
          onClick={() => {
            close()
            item.onSelect()
          }}
          className={itemClass(item.destructive)}
        >
          {item.icon}
          {item.label}
        </button>
      ),
    )

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(event) => {
          event.stopPropagation()
          if (open) close(false)
          else openMenu()
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !open) {
            event.preventDefault()
            openMenu()
          }
        }}
        className={cn(
          'inline-flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded-lg md:rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          open && 'bg-accent text-foreground',
        )}
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>

      {open && position && isDesktop && createPortal(
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}
          onKeyDown={onMenuKeyDown}
          style={{ position: 'fixed', top: position.top, left: position.left, width: MENU_WIDTH }}
          className={cn(
            'z-50 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg',
            position.placement === 'above' && '-translate-y-full',
          )}
        >
          {renderMenuItems()}
        </div>,
        document.body,
      )}

      {open && !isDesktop && createPortal(
        <div
          ref={sheetWrapperRef}
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs"
          onClick={(event) => {
            event.stopPropagation()
            if (event.target === event.currentTarget) close()
          }}
        >
          <div className="dialog-enter rounded-t-2xl border-t border-border bg-card p-3 pb-6 text-card-foreground shadow-2xl">
            <div aria-hidden="true" className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-muted-foreground/25" />
            {title && (
              <p aria-hidden="true" className="mb-1.5 truncate border-b border-border/60 px-3.5 pb-2.5 text-xs font-semibold text-muted-foreground">
                {title}
              </p>
            )}
            <div
              ref={menuRef}
              id={menuId}
              role="menu"
              aria-label={label}
              onKeyDown={onMenuKeyDown}
              className="space-y-0.5"
            >
              {renderMenuItems()}
            </div>
            <button
              type="button"
              onClick={() => close()}
              className="mt-2 min-h-11 w-full rounded-xl bg-muted/70 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Cancel
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
