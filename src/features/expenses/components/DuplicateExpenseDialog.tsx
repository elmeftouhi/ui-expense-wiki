import { useRef } from 'react'
import { AlertTriangle, Calendar, CreditCard, DollarSign, FileText, Folder, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExpenseDialog } from './ExpenseDialog'
import { ExpenseStatusBadge } from './ExpenseStatusBadge'
import { formatDate, formatTenantCurrency } from '@/lib/formatters'
import { useActiveTenant } from '@/features/tenants'
import type { DuplicateExpenseDetails, ExpenseStatus } from '../types'

export interface DuplicateExpenseDialogProps {
  matchingExpense: DuplicateExpenseDetails
  message?: string
  isSubmitting?: boolean
  categoryFallbackName?: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

export function DuplicateExpenseDialog({
  matchingExpense,
  message,
  isSubmitting = false,
  categoryFallbackName,
  onCancel,
  onConfirm,
}: DuplicateExpenseDialogProps) {
  const { activeTenant } = useActiveTenant()
  const confirmClickedRef = useRef(false)

  const amountDisplay = typeof matchingExpense.amount === 'number'
    ? formatTenantCurrency(matchingExpense.amount, activeTenant)
    : undefined

  const dateValue = matchingExpense.dueDate || matchingExpense.paidDate || matchingExpense.date
  const categoryDisplay = matchingExpense.categoryName || categoryFallbackName || 'Category'
  const paymentMethodDisplay = matchingExpense.paymentMethodName || matchingExpense.paymentMethod

  const status = (matchingExpense.status && ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'].includes(matchingExpense.status))
    ? (matchingExpense.status as ExpenseStatus)
    : null

  const handleConfirm = () => {
    if (isSubmitting || confirmClickedRef.current) return
    confirmClickedRef.current = true
    try {
      void onConfirm()
    } finally {
      // Release in next event cycle if not still unmounted
      setTimeout(() => {
        confirmClickedRef.current = false
      }, 500)
    }
  }

  return (
    <ExpenseDialog
      title="Possible duplicate expense"
      description={message || 'An existing expense with the same category, amount, and date was found in this workspace.'}
      onClose={isSubmitting ? () => {} : onCancel}
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-medium">Duplicate warning</p>
            <p className="text-xs text-muted-foreground">
              Please review the matching expense below. You can edit or cancel your draft, or add this expense anyway.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2.5 text-sm">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Matching expense</span>
            {status && <ExpenseStatusBadge status={status} compact />}
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {amountDisplay && (
              <div className="space-y-0.5">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <DollarSign className="h-3.5 w-3.5" /> Amount
                </span>
                <span className="font-mono font-semibold text-foreground">{amountDisplay}</span>
              </div>
            )}

            {dateValue && (
              <div className="space-y-0.5">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" /> Date
                </span>
                <span className="font-medium text-foreground">{formatDate(dateValue)}</span>
              </div>
            )}

            <div className="space-y-0.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Folder className="h-3.5 w-3.5" /> Category
              </span>
              <span className="font-medium text-foreground">{categoryDisplay}</span>
            </div>

            {paymentMethodDisplay && (
              <div className="space-y-0.5">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CreditCard className="h-3.5 w-3.5" /> Payment method
                </span>
                <span className="text-foreground">{paymentMethodDisplay}</span>
              </div>
            )}
          </div>

          {matchingExpense.description && (
            <div className="border-t border-border/60 pt-2 space-y-0.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Description
              </span>
              <p className="text-foreground">{matchingExpense.description}</p>
            </div>
          )}

          {matchingExpense.notes && (
            <div className="border-t border-border/60 pt-2 space-y-0.5">
              <span className="text-xs text-muted-foreground">Notes</span>
              <p className="text-xs text-muted-foreground italic">{matchingExpense.notes}</p>
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={onCancel}
          >
            Edit / cancel
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Add anyway
          </Button>
        </div>
      </div>
    </ExpenseDialog>
  )
}

