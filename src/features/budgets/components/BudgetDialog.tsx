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
 * Modal shell matching the existing app dialogs, with keyboard focus kept inside the dialog.
 */
export const BudgetDialog: React.FC<BudgetDialogProps> = ({
  title,
  description,
  icon,
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
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
          'dialog-enter custom-scrollbar max-h-[92vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
          <div className="flex items-start gap-2.5">
            {icon && <div className="rounded-xl bg-primary/10 p-2 text-primary">{icon}</div>}
            <div>
              <h2 id={titleId} className="text-base font-bold text-foreground">
                {title}
              </h2>
              {description && (
                <p id={descriptionId} className="mt-0.5 text-xs text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={!dismissible}
            aria-label="Close dialog"
            className="cursor-pointer rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
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
