import { createContext } from 'react'

export type ToastVariant = 'success' | 'error' | 'info' | 'warning'

export interface ToastOptions {
  title: string
  description?: string
  variant?: ToastVariant
  /** Auto-dismiss delay in ms. Use 0 to keep the toast until dismissed manually. */
  durationMs?: number
}

export interface ToastItem extends Required<Omit<ToastOptions, 'description'>> {
  id: number
  description?: string
}

export interface ToastContextValue {
  toast: (options: ToastOptions) => number
  success: (title: string, description?: string) => number
  error: (title: string, description?: string) => number
  info: (title: string, description?: string) => number
  dismiss: (id: number) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)
