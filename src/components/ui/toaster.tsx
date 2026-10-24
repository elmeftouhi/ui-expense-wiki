import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  ToastContext,
  type ToastContextValue,
  type ToastItem,
  type ToastOptions,
  type ToastVariant,
} from './toast-context'

const DEFAULT_DURATION_MS = 4500
const MAX_VISIBLE_TOASTS = 4

const VARIANT_STYLES: Record<ToastVariant, { icon: React.ComponentType<{ className?: string }>; className: string; iconClassName: string }> = {
  success: {
    icon: CheckCircle2,
    className: 'border-emerald-500/30',
    iconClassName: 'text-emerald-600 dark:text-emerald-400',
  },
  error: {
    icon: AlertCircle,
    className: 'border-destructive/40',
    iconClassName: 'text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    className: 'border-amber-500/30',
    iconClassName: 'text-amber-600 dark:text-amber-400',
  },
  info: {
    icon: Info,
    className: 'border-primary/30',
    iconClassName: 'text-primary',
  },
}

interface ToastProviderProps {
  children: React.ReactNode
}

/**
 * Global toast/snackbar provider. Renders a fixed viewport (bottom-right) and exposes
 * an imperative API through `useToast()`.
 */
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timersRef.current.delete(id)
    }
  }, [])

  const toast = useCallback(
    ({ title, description, variant = 'info', durationMs = DEFAULT_DURATION_MS }: ToastOptions) => {
      idRef.current += 1
      const id = idRef.current
      setToasts((prev) => [...prev, { id, title, description, variant, durationMs }].slice(-MAX_VISIBLE_TOASTS))
      if (durationMs > 0) {
        timersRef.current.set(
          id,
          setTimeout(() => dismiss(id), durationMs),
        )
      }
      return id
    },
    [dismiss],
  )

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach((timer) => clearTimeout(timer))
      timers.clear()
    }
  }, [])

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, variant: 'success' }),
      error: (title, description) => toast({ title, description, variant: 'error', durationMs: 7000 }),
      info: (title, description) => toast({ title, description, variant: 'info' }),
    }),
    [toast, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2"
      >
        {toasts.map((t) => {
          const { icon: Icon, className, iconClassName } = VARIANT_STYLES[t.variant]
          return (
            <div
              key={t.id}
              role={t.variant === 'error' ? 'alert' : 'status'}
              className={cn(
                'toast-enter pointer-events-auto flex items-start gap-3 rounded-xl border bg-card/95 p-3.5 shadow-lg backdrop-blur-md',
                className,
              )}
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', iconClassName)} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{t.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
