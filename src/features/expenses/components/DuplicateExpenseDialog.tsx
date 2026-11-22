import { useRef } from 'react'
import { AlertTriangle, Calendar, CreditCard, DollarSign, FileText, Folder, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExpenseDialog } from './ExpenseDialog'
import { ExpenseStatusBadge } from './ExpenseStatusBadge'
import { formatDate, formatTenantCurrency } from '@/lib/formatters'
import { useActiveTenant } from '@/features/tenants'
import type { DuplicateExpenseDetails, ExpenseStatus } from '../types'

export interface SubmittedExpenseDetails {
  amount?: number
  dueDate?: string
  paidDate?: string | null
  date?: string
  categoryName?: string
  description?: string
  notes?: string | null
  paymentMethodName?: string | null
}

export interface DuplicateExpenseDialogProps {
  matchingExpense?: DuplicateExpenseDetails
  submittedExpense?: SubmittedExpenseDetails
  message?: string
  isSubmitting?: boolean
  categoryFallbackName?: string
  onCancel: () => void
  onConfirm: () => void | Promise<void>
}

export function DuplicateExpenseDialog({
  matchingExpense = {},
  submittedExpense,
  message,
  isSubmitting = false,
  categoryFallbackName,
  onCancel,
  onConfirm,
}: DuplicateExpenseDialogProps) {
  const { activeTenant } = useActiveTenant()
  const confirmClickedRef = useRef(false)

  const effectiveAmount = typeof matchingExpense.amount === 'number'
    ? matchingExpense.amount
    : submittedExpense?.amount

  const amountDisplay = typeof effectiveAmount === 'number'
    ? formatTenantCurrency(effectiveAmount, activeTenant)
    : undefined

  const dateValue =
    matchingExpense.dueDate ||
    matchingExpense.paidDate ||
    matchingExpense.date ||
    submittedExpense?.dueDate ||
    submittedExpense?.paidDate ||
    submittedExpense?.date

  const categoryDisplay =
    matchingExpense.categoryName ||
    categoryFallbackName ||
    submittedExpense?.categoryName ||
    'Selected category'

  const paymentMethodDisplay =
    matchingExpense.paymentMethodName ||
    matchingExpense.paymentMethod ||
    submittedExpense?.paymentMethodName

  const descriptionDisplay = matchingExpense.description || submittedExpense?.description
  const notesDisplay = matchingExpense.notes || submittedExpense?.notes

  const status = (matchingExpense.status && ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED'].includes(matchingExpense.status))
    ? (matchingExpense.status as ExpenseStatus)
    : null

  const handleConfirm = () => {
    if (isSubmitting || confirmClickedRef.current) return
    confirmClickedRef.current = true
    try {
      void onConfirm()
    } finally {
      setTimeout(() => {
        confirmClickedRef.current = false
      }, 500)
    }
  }

  return (
    <ExpenseDialog
      title="Expense already exists"
      description={message || 'An expense with the same category, amount, and date already exists in this workspace.'}
      onClose={isSubmitting ? () => {} : onCancel}
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-medium">Possible duplicate detected</p>
            <p className="text-xs text-muted-foreground">
              A matching expense was found. You can review the details below, edit your draft, or choose to save anyway.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/40 p-3.5 space-y-2.5 text-sm">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Expense details</span>
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

          {descriptionDisplay && (
            <div className="border-t border-border/60 pt-2 space-y-0.5">
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileText className="h-3.5 w-3.5" /> Description
              </span>
              <p className="text-foreground">{descriptionDisplay}</p>
            </div>
          )}

          {notesDisplay && (
            <div className="border-t border-border/60 pt-2 space-y-0.5">
              <span className="text-xs text-muted-foreground">Notes</span>
              <p className="text-xs text-muted-foreground italic">{notesDisplay}</p>
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
            Cancel / Edit
          </Button>
          <Button
            type="button"
            variant="default"
            disabled={isSubmitting}
            onClick={handleConfirm}
            className="gap-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save anyway
          </Button>
        </div>
      </div>
    </ExpenseDialog>
  )
}
