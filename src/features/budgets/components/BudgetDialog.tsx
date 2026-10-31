import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BudgetDialogProps {
  title: string
  description?: string
  icon?: React.ReactNode
  onClose: () => void
  children: React.ReactNode
  className?: string
  /** Disable closing via Escape/backdrop (e.g. while submitting). */
  dismissible?: boolean
}

/**
 * Responsive modal shell: bottom-anchored sheet on mobile (< 640px) and centered modal on desktop.
 */
export const BudgetDialog: React.FC<BudgetDialogProps> = ({
  title,
  description,
  onClose,
  children,
  className,
  dismissible = true,
}) => {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [returnFocus] = useState(() => document.activeElement)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!dialogRef.current?.contains(document.activeElement)) {
      dialogRef.current?.focus()
    }
    return () => {
      document.body.style.overflow = previousOverflow
      if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus()
    }
  }, [returnFocus])

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-xs sm:items-center sm:bg-background/80 sm:p-4 sm:backdrop-blur-sm"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && dismissible) {
            event.stopPropagation()
            onClose()
          }
          if (event.key !== 'Tab') return
          const controls = dialogRef.current?.querySelectorAll<HTMLElement>(
            ':is(a[href], button, input, select, textarea, [tabindex]):not(:disabled):not([tabindex="-1"])',
          )
          if (!controls?.length) {
            event.preventDefault()
            dialogRef.current?.focus()
            return
          }
          const first = controls[0]
          const last = controls[controls.length - 1]
          if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) {
            event.preventDefault()
            first.focus()
          }
        }}
        className={cn(
          'dialog-enter custom-scrollbar max-h-[90vh] w-full space-y-4 overflow-y-auto rounded-t-2xl border border-border bg-card p-5 pb-6 text-card-foreground shadow-2xl sm:max-w-lg sm:rounded-xl sm:p-5 sm:shadow-xl',
          className,
        )}
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-1 h-1 w-10 rounded-full bg-muted-foreground/25 sm:hidden"
        />
        <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-foreground">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            aria-label="Close dialog"
            className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}
