import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { useActiveTenant } from '@/features/tenants'
import { useCategoryOptions } from '@/features/budgets/hooks/useCategoryOptions'
import { fieldInputClass, fieldInvalidClass } from '@/features/budgets/components/FormControls'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { useCreateExpense, useExpense, useUpdateExpense } from '../hooks/useExpenses'
import { expenseFormSchema, expenseToFormValues, toExpensePayload, type ExpenseFormValues } from '../schemas/expenseSchema'
import { CategoryTreeSelect } from '@/features/categories/components/CategoryTreeSelect'
import { PaymentMethodSelect } from '@/features/payment-methods/PaymentMethodSelect'
import { usePaymentMethods } from '@/features/payment-methods/usePaymentMethods'

function todayDate() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

const createDefaults = (): ExpenseFormValues => ({
  categoryId: 0,
  description: '',
  amount: 0,
  dueDate: todayDate(),
  paidDate: todayDate(),
  type: 'NORMAL',
  paymentMethodId: undefined,
  notes: '',
})

export function ExpenseFormPage() {
  const { activeTenant } = useActiveTenant()
  return <ExpenseFormContent key={activeTenant.id} />
}

function ExpenseFormContent() {
  const { expenseId: rawId } = useParams()
  const expenseId = rawId ? Number(rawId) : undefined
  const isEditing = expenseId !== undefined
  const { canEdit, activeTenant } = useActiveTenant()
  const navigate = useNavigate()
  const toast = useToast()
  const categories = useCategoryOptions()
  const paymentMethods = usePaymentMethods()
  const detail = useExpense(expenseId)
  const createExpense = useCreateExpense()
  const updateExpense = useUpdateExpense()
  const [serverError, setServerError] = useState<string | null>(null)
  const form = useForm<ExpenseFormValues>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: createDefaults(),
    mode: 'onTouched',
  })
  const { control, reset } = form

  useEffect(() => {
    if (detail.data) reset(expenseToFormValues(detail.data))
  }, [detail.data, reset])
  const selectedType = useWatch({ control, name: 'type' })
  const paymentMethodId = useWatch({ control, name: 'paymentMethodId' })
  const { setValue, getFieldState } = form
  useEffect(() => {
    if (!isEditing && !getFieldState('paymentMethodId').isDirty && paymentMethodId === undefined) {
      const defaultMethod = paymentMethods.data?.find((method) => method.active && method.isDefault)
      if (defaultMethod) setValue('paymentMethodId', defaultMethod.id)
    }
  }, [isEditing, paymentMethods.data, paymentMethodId, getFieldState, setValue])
  const categoryId = useWatch({ control, name: 'categoryId' })
  const selectedCategory = categories.options.find((option) => option.id === categoryId)
  // Normal expenses are recorded when paid, so the due date only matters for subscription bills.
  const showDueDate = isEditing || selectedType === 'SUBSCRIPTION'

  const submit = async (values: ExpenseFormValues, addNew = false) => {
    setServerError(null)
    if (paymentMethods.isPending || paymentMethods.error || !paymentMethods.data?.some((method) => method.active && method.id === values.paymentMethodId)) {
      form.setError('paymentMethodId', { message: 'Choose an active payment method before saving.' })
      return
    }
    if (!showDueDate) values = { ...values, dueDate: values.paidDate || todayDate() }
    try {
      const categoryName = categories.options.find((option) => option.id === values.categoryId)?.name
        ?? (detail.data?.categoryId === values.categoryId ? detail.data.categoryName : '')
      const payload = toExpensePayload(values, categoryName)
      if (isEditing && expenseId) {
        const updated = await updateExpense.mutateAsync({ id: expenseId, payload })
        toast.success('Expense updated.')
        navigate(`/expenses/${updated.id}`)
      } else {
        const created = await createExpense.mutateAsync(payload)
        toast.success('Expense recorded.')
        if (addNew) {
          reset({ ...createDefaults(), paymentMethodId: paymentMethods.data?.find((method) => method.active && method.isDefault)?.id })
          setTimeout(() => form.setFocus('categoryId'), 0)
        } else {
          navigate(`/expenses/${created.id}`)
        }
      }
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Could not save this expense.'))
    }
  }

  if (!canEdit) {
    return <Card><CardContent className="space-y-3 p-8"><h1 className="text-xl font-semibold">Expense changes are restricted</h1><p className="text-sm text-muted-foreground">Your role does not allow creating or editing expenses.</p><Button asChild variant="outline"><Link to="/expenses">Back to expenses</Link></Button></CardContent></Card>
  }
  if (isEditing && detail.isLoading) return <Card><CardContent className="p-8 text-sm text-muted-foreground">Loading expense…</CardContent></Card>
  if (isEditing && (detail.error || !detail.data)) {
    return <Card><CardContent className="space-y-3 p-8"><p role="alert" className="text-sm text-destructive">{getApiErrorMessage(detail.error, 'Expense could not be loaded.')}</p><Button asChild variant="outline"><Link to="/expenses">Back to expenses</Link></Button></CardContent></Card>
  }

  const { register, handleSubmit, formState: { errors, isSubmitting } } = form
  const saveDisabled = isSubmitting || createExpense.isPending || updateExpense.isPending || categories.isLoading || !!categories.error
    || paymentMethods.isPending || !!paymentMethods.error || !paymentMethods.data?.some((method) => method.active && method.id === paymentMethodId)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link to={isEditing && expenseId ? `/expenses/${expenseId}` : '/expenses'} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{isEditing ? 'Back to expense' : 'Back to expenses'}</Link>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{isEditing ? 'Edit expense' : 'Record an expense'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a category, enter the amount, and save. Add a description only if you need one.</p>
      </header>
      <Card>
        <CardContent className="p-5 sm:p-7">
          {serverError && <div role="alert" className="mb-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{serverError}</div>}
          {categories.error && <div role="alert" className="mb-5 rounded-lg border border-destructive/30 p-3 text-sm text-destructive">Categories could not be loaded. {getApiErrorMessage(categories.error)} <button type="button" className="underline" onClick={() => void categories.refetch()}>Retry</button></div>}
          <form noValidate onSubmit={handleSubmit((values) => submit(values))} className="space-y-5">
            <Controller name="categoryId" control={control} render={({ field }) => (
              <div className="space-y-1.5 text-sm font-medium">
                <label htmlFor="expense-category" className="block">Category</label>
                <CategoryTreeSelect
                  id="expense-category"
                  options={categories.options}
                  value={field.value}
                  onChange={(id) => {
                    field.onChange(id ?? 0)
                    if (id) form.setFocus('amount', { shouldSelect: true })
                  }}
                  onBlur={field.onBlur}
                  triggerRef={field.ref}
                  invalid={!!errors.categoryId}
                  aria-describedby={errors.categoryId ? 'expense-category-error' : undefined}
                  fallbackLabel={detail.data?.categoryId === field.value ? detail.data.categoryName : undefined}
                  isLoading={categories.isLoading}
                  disabled={!!categories.error}
                  autoFocus={!isEditing}
                  className="font-normal"
                />
                {errors.categoryId && <span id="expense-category-error" role="alert" className="block text-xs text-destructive">{errors.categoryId.message}</span>}
              </div>
            )} />
              <label className="block space-y-1.5 text-sm font-medium" htmlFor="expense-amount">
                Amount
                <input id="expense-amount" type="number" min="0.01" step="0.01" inputMode="decimal" className={cn(fieldInputClass, 'font-mono', errors.amount && fieldInvalidClass)} {...register('amount', { valueAsNumber: true })} />
                <span className="block text-xs text-muted-foreground">Currency: {activeTenant.currency}</span>
                {errors.amount && <span role="alert" className="block text-xs text-destructive">{errors.amount.message}</span>}
              </label>
            <label className="block space-y-1.5 text-sm font-medium" htmlFor="expense-description">
              Description <span className="font-normal text-muted-foreground">(optional)</span>
              <input id="expense-description" maxLength={500} placeholder={selectedCategory?.name ?? 'Defaults to the category name'} aria-describedby="expense-description-hint" className={cn(fieldInputClass, errors.description && fieldInvalidClass)} {...register('description')} />
              <span id="expense-description-hint" className="block text-xs font-normal text-muted-foreground">Leave blank to use {selectedCategory ? `"${selectedCategory.name}"` : 'the selected category name'}.</span>
              {errors.description && <span role="alert" className="block text-xs text-destructive">{errors.description.message}</span>}
            </label>
            <div className={cn('grid gap-5', showDueDate ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
              <label className="block space-y-1.5 text-sm font-medium" htmlFor="expense-type">
                Type
                <select id="expense-type" className={fieldInputClass} {...register('type')}>
                  <option value="NORMAL">Normal</option>
                  <option value="SUBSCRIPTION">Subscription bill</option>
                </select>
              </label>
              {showDueDate && (
                <label className="block space-y-1.5 text-sm font-medium" htmlFor="expense-due-date">
                  Due date
                  <input id="expense-due-date" type="date" className={cn(fieldInputClass, errors.dueDate && fieldInvalidClass)} {...register('dueDate')} />
                  {errors.dueDate && <span role="alert" className="block text-xs text-destructive">{errors.dueDate.message}</span>}
                </label>
              )}
              <label className="block space-y-1.5 text-sm font-medium" htmlFor="expense-paid-date">
                Paid date <span className="font-normal text-muted-foreground">(optional)</span>
                <input id="expense-paid-date" type="date" className={cn(fieldInputClass, errors.paidDate && fieldInvalidClass)} {...register('paidDate')} />
                {errors.paidDate && <span role="alert" className="block text-xs text-destructive">{errors.paidDate.message}</span>}
              </label>
            </div>
            {selectedType === 'SUBSCRIPTION' && <p className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-sm text-muted-foreground">This records a subscription bill as an expense. To create or change a recurring subscription schedule, go to <Link className="font-medium text-primary underline underline-offset-4" to="/subscriptions">Subscriptions</Link>.</p>}
            <div className="space-y-1.5 text-sm font-medium">
              <label htmlFor="expense-payment-method">Payment method</label>
              <Controller name="paymentMethodId" control={control} render={({ field }) => (
                <PaymentMethodSelect id="expense-payment-method" value={field.value} onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} fallbackLabel={detail.data?.paymentMethod} invalid={!!errors.paymentMethodId} />
              )} />
              {errors.paymentMethodId && <span role="alert" className="block text-xs text-destructive">{errors.paymentMethodId.message}</span>}
            </div>
            <label className="block space-y-1.5 text-sm font-medium" htmlFor="expense-notes">
              Notes <span className="font-normal text-muted-foreground">(optional)</span>
              <textarea id="expense-notes" rows={4} maxLength={1000} className={cn(fieldInputClass, 'h-auto py-2', errors.notes && fieldInvalidClass)} {...register('notes')} />
              {errors.notes && <span role="alert" className="block text-xs text-destructive">{errors.notes.message}</span>}
            </label>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
              <Button asChild type="button" variant="outline"><Link to={isEditing && expenseId ? `/expenses/${expenseId}` : '/expenses'}>Cancel</Link></Button>
              {!isEditing && <Button type="button" variant="outline" disabled={saveDisabled} onClick={handleSubmit((values) => submit(values, true))}>Save and add new</Button>}
              <Button type="submit" disabled={saveDisabled} className="gap-2"><Save className="h-4 w-4" />{isEditing ? 'Save changes' : 'Record expense'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
