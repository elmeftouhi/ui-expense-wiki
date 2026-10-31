import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useToast } from '@/components/ui/use-toast'
import { Button } from '@/components/ui/button'
import { useActiveTenant } from '@/features/tenants'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { fieldInputClass, fieldInvalidClass } from '@/features/budgets/components/FormControls'
import { formatCurrency } from '@/lib/formatters'
import { useChangeExpenseStatus, useDeleteExpense, useMarkExpenseAsPaid } from '../hooks/useExpenses'
import { expenseStatusChangeSchema, markAsPaidSchema, toDateOnly, toExpenseStatusPayload, type ExpenseStatusFormValues } from '../schemas/expenseSchema'
import { ExpenseDialog } from './ExpenseDialog'
import { ExpenseRowMenu } from './ExpenseRowMenu'
import { ArrowLeftRight, CircleCheck, Eye, Pencil, Trash2 } from 'lucide-react'
import type { ExpenseResponse, ExpenseStatus } from '../types'

const STATUSES: ExpenseStatus[] = ['PENDING', 'PAID', 'OVERDUE', 'CANCELLED']

export function ExpenseActions({
  expense,
  canEdit,
  onDeleted,
  variant = 'full',
  fromSearch,
}: {
  expense: ExpenseResponse
  canEdit: boolean
  onDeleted?: () => void
  /** `compact` renders a quick "mark as paid" icon plus an overflow menu, for list rows. */
  variant?: 'full' | 'compact'
  /** Optional URL query string from the expenses list so Back navigation restores filters. */
  fromSearch?: string
}) {
  const { activeTenant } = useActiveTenant()
  const navigate = useNavigate()
  const toast = useToast()
  const [dialog, setDialog] = useState<'paid' | 'status' | 'delete' | null>(null)
  const [paidDate, setPaidDate] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })
  const [serverError, setServerError] = useState<string | null>(null)
  const markPaid = useMarkExpenseAsPaid()
  const changeStatus = useChangeExpenseStatus()
  const deleteExpense = useDeleteExpense()
  const linkState = fromSearch ? { fromExpensesSearch: fromSearch } : undefined

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ExpenseStatusFormValues>({
    resolver: zodResolver(expenseStatusChangeSchema),
    defaultValues: { status: expense.status, paidDate: expense.paidDate ?? '' },
  })

  const closeDialog = () => {
    setDialog(null)
    setServerError(null)
  }

  const confirmPaid = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setServerError(null)
    const parsed = markAsPaidSchema.safeParse({ paidDate })
    if (!parsed.success) {
      setServerError(parsed.error.issues[0]?.message ?? 'Enter a valid paid date.')
      return
    }
    try {
      await markPaid.mutateAsync({ id: expense.id, paidDate: toDateOnly(parsed.data.paidDate) })
      toast.success('Expense marked as paid.')
      closeDialog()
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Could not mark this expense as paid.'))
    }
  }

  const confirmStatus = async (values: ExpenseStatusFormValues) => {
    setServerError(null)
    try {
      await changeStatus.mutateAsync({
        id: expense.id,
        payload: toExpenseStatusPayload(values, expense.status),
      })
      toast.success('Expense status updated.')
      closeDialog()
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Could not update the expense status.'))
    }
  }

  const confirmDelete = async () => {
    setServerError(null)
    try {
      await deleteExpense.mutateAsync(expense.id)
      toast.success('Expense deleted.')
      closeDialog()
      if (onDeleted) onDeleted()
      else navigate(fromSearch ? `/expenses${fromSearch}` : '/expenses')
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Could not delete this expense.'))
    }
  }

  const openStatusDialog = () => {
    reset({ status: expense.status, paidDate: expense.paidDate ?? '' })
    setDialog('status')
  }

  const compactActions = canEdit && (
    <div
      className="flex items-center justify-end gap-1 md:gap-0.5"
      onClick={(event) => event.stopPropagation()}
    >
      {expense.status !== 'PAID' && (
        <button
          type="button"
          aria-label={`Mark ${expense.description} as paid`}
          title="Mark as paid"
          onClick={(event) => {
            event.stopPropagation()
            setDialog('paid')
          }}
          className="inline-flex h-9 w-9 md:h-8 md:w-8 items-center justify-center rounded-lg md:rounded-md text-muted-foreground transition-colors hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CircleCheck className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <ExpenseRowMenu
        label={`More actions for ${expense.description}`}
        title={expense.description}
        items={[
          { key: 'view', label: 'View details', icon: <Eye className="h-4 w-4" aria-hidden="true" />, to: `/expenses/${expense.id}`, state: linkState },
          { key: 'edit', label: 'Edit', icon: <Pencil className="h-4 w-4" aria-hidden="true" />, to: `/expenses/${expense.id}/edit`, state: linkState },
          { key: 'status', label: 'Change status', icon: <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />, onSelect: openStatusDialog },
          { key: 'delete', label: 'Delete', icon: <Trash2 className="h-4 w-4" aria-hidden="true" />, onSelect: () => setDialog('delete'), destructive: true },
        ]}
      />
    </div>
  )

  return (
    <>
      {variant === 'compact' ? compactActions : (
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline"><Link to={`/expenses/${expense.id}`} state={linkState}>View</Link></Button>
        {canEdit && (
          <>
            <Button asChild size="sm" variant="outline"><Link to={`/expenses/${expense.id}/edit`} state={linkState}>Edit</Link></Button>
            {expense.status !== 'PAID' && <Button size="sm" onClick={() => setDialog('paid')}>Mark as paid</Button>}
            <Button size="sm" variant="outline" onClick={openStatusDialog}>Change status</Button>
            <Button size="sm" variant="destructive" onClick={() => setDialog('delete')}>Delete</Button>
          </>
        )}
      </div>
      )}
      {dialog === 'paid' && (
        <ExpenseDialog title="Mark as paid" description={`Record when “${expense.description}” was paid.`} onClose={closeDialog}>
          <form onSubmit={(event) => void confirmPaid(event)} className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium" htmlFor={`paid-date-${expense.id}`}>
              Paid date
              <input id={`paid-date-${expense.id}`} type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} className={fieldInputClass} required />
            </label>
            {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={markPaid.isPending}>{markPaid.isPending ? 'Saving…' : 'Mark as paid'}</Button>
            </div>
          </form>
        </ExpenseDialog>
      )}
      {dialog === 'status' && (
        <ExpenseDialog title="Change expense status" description="Choose a new status. Paid expenses require a paid date." onClose={closeDialog}>
          <form onSubmit={handleSubmit(confirmStatus)} className="space-y-4">
            <label className="block space-y-1.5 text-sm font-medium" htmlFor={`expense-status-${expense.id}`}>
              Status
              <select id={`expense-status-${expense.id}`} className={fieldInputClass} {...register('status')}>
                {STATUSES.map((status) => <option key={status} value={status}>{status.toLowerCase()}</option>)}
              </select>
            </label>
            <label className="block space-y-1.5 text-sm font-medium" htmlFor={`expense-status-paid-date-${expense.id}`}>
              Paid date
              <input id={`expense-status-paid-date-${expense.id}`} type="date" className={cn(fieldInputClass, errors.paidDate && fieldInvalidClass)} {...register('paidDate')} />
            </label>
            {errors.paidDate && <p role="alert" className="text-xs text-destructive">{errors.paidDate.message}</p>}
            {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting || changeStatus.isPending}>Save status</Button>
            </div>
          </form>
        </ExpenseDialog>
      )}
      {dialog === 'delete' && (
        <ExpenseDialog title="Delete this expense?" description="This removes the expense from active lists. Existing linked subscription schedules are not changed." onClose={closeDialog}>
          <div className="space-y-4">
            {serverError && <p role="alert" className="text-sm text-destructive">{serverError}</p>}
            <p className="text-sm text-muted-foreground">Delete “{expense.description}” for {formatCurrency(expense.amount, { currency: expense.currency, locale: activeTenant.locale })}?</p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Keep expense</Button>
              <Button variant="destructive" disabled={deleteExpense.isPending} onClick={() => void confirmDelete()}>{deleteExpense.isPending ? 'Deleting…' : 'Delete expense'}</Button>
            </div>
          </div>
        </ExpenseDialog>
      )}
    </>
  )
}
