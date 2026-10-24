import { useContext } from 'react'
import { ToastContext, type ToastContextValue } from './toast-context'

/**
 * Access the global toast/snackbar API.
 * Must be used inside <ToastProvider> (mounted in AppProviders).
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a <ToastProvider>')
  }
  return context
}
