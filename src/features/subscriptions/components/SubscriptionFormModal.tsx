import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useActiveTenant } from '@/features/tenants'
import { useCategoryOptions } from '@/features/budgets/hooks/useCategoryOptions'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { FormField, fieldInputClass, fieldInvalidClass } from '@/features/budgets/components/FormControls'
import { CategoryTreeSelect } from '@/features/categories/components/CategoryTreeSelect'
import { PaymentMethodSelect } from '@/features/payment-methods/PaymentMethodSelect'
import { usePaymentMethods } from '@/features/payment-methods/usePaymentMethods'
import type { Subscription } from '../types'
import {
  DEFAULT_SUBSCRIPTION_FORM_VALUES,
  subscriptionFormSchema,
  toSubscriptionPayload,
  type SubscriptionFormValues,
} from '../schemas/subscriptionSchema'
import { SUBSCRIPTION_FREQUENCIES } from '../types'
import { SubscriptionDialog } from './SubscriptionDialog'

const FREQUENCY_LABELS: Record<(typeof SUBSCRIPTION_FREQUENCIES)[number], string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every two weeks',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMIANNUAL: 'Every six months',
  ANNUAL: 'Annual',
  YEARLY: 'Yearly',
  CUSTOM: 'Custom interval',
}

interface SubscriptionFormModalProps {
  subscription?: Subscription | null
  onClose: () => void
  onSubmit: (values: ReturnType<typeof toSubscriptionPayload>) => Promise<void>
}

const inputClass = `${fieldInputClass} text-sm`

function initialValues(subscription?: Subscription | null): SubscriptionFormValues {
  if (!subscription) return DEFAULT_SUBSCRIPTION_FORM_VALUES
  return {
    name: subscription.name,
    description: subscription.description ?? '',
    categoryId: subscription.categoryId,
    amount: subscription.amount,
    frequency: subscription.frequency,
    customIntervalDays: subscription.customIntervalDays ?? undefined,
    nextBillingDate: subscription.nextBillingDate,
    endDate: subscription.endDate ?? '',
    reminderLeadDays: subscription.reminderLeadDays,
    paymentMethodId: subscription.paymentMethodId ?? undefined,
    notes: subscription.notes ?? '',
  }
}

export function SubscriptionFormModal({ subscription, onClose, onSubmit }: SubscriptionFormModalProps) {
  const { activeTenant } = useActiveTenant()
  return <SubscriptionFormContent key={activeTenant.id} subscription={subscription} onClose={onClose} onSubmit={onSubmit} />
}

function SubscriptionFormContent({ subscription, onClose, onSubmit }: SubscriptionFormModalProps) {
  const { activeTenant } = useActiveTenant()
  const categories = useCategoryOptions()
  const paymentMethods = usePaymentMethods()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    setValue,
    getFieldState,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionFormSchema),
    defaultValues: initialValues(subscription),
    mode: 'onTouched',
  })
  const frequency = useWatch({ control, name: 'frequency' })
  const paymentMethodId = useWatch({ control, name: 'paymentMethodId' })
  useEffect(() => {
    if (!subscription && !getFieldState('paymentMethodId').isDirty && paymentMethodId === undefined) {
      const defaultMethod = paymentMethods.data?.find((method) => method.active && method.isDefault)
      if (defaultMethod) setValue('paymentMethodId', defaultMethod.id)
    }
  }, [subscription, paymentMethods.data, paymentMethodId, getFieldState, setValue])
  const nextBillingDate = useWatch({ control, name: 'nextBillingDate' })

  const submit = async (values: SubscriptionFormValues) => {
    setServerError(null)
    if (paymentMethods.isPending || paymentMethods.error || !paymentMethods.data?.some((method) => method.active && method.id === values.paymentMethodId)) {
      setError('paymentMethodId', { message: 'Choose an active payment method before saving.' })
      return
    }
    try {
      await onSubmit({ ...toSubscriptionPayload(values), currency: activeTenant.currency })
      onClose()
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Could not save subscription.'))
    }
  }

  return (
    <SubscriptionDialog
      title={subscription ? 'Edit subscription' : 'Create subscription'}
      description="Track a recurring commitment. Bills are generated separately as pending expenses on their due dates."
      onClose={onClose}
      dismissible={!isSubmitting}
    >
      {serverError && (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {serverError}
        </div>
      )}
      {categories.error && (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-xs text-destructive">
          <p>Could not load categories. {getApiErrorMessage(categories.error)}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void categories.refetch()}>Retry categories</Button>
        </div>
      )}
      <form noValidate onSubmit={handleSubmit(submit)} className="space-y-4">
        <FormField label="Name" htmlFor="subscription-name" required error={errors.name?.message}>
          <input id="subscription-name" autoFocus maxLength={120} className={cn(inputClass, errors.name && fieldInvalidClass)} {...register('name')} />
        </FormField>
        <FormField label="Description" htmlFor="subscription-description" error={errors.description?.message}>
          <textarea id="subscription-description" rows={2} className={cn(inputClass, 'h-auto py-2', errors.description && fieldInvalidClass)} {...register('description')} />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Category" htmlFor="subscription-category" required error={errors.categoryId?.message}>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <CategoryTreeSelect
                  id="subscription-category"
                  options={categories.options}
                  value={field.value}
                  onChange={(id) => field.onChange(id ?? 0)}
                  onBlur={field.onBlur}
                  triggerRef={field.ref}
                  invalid={!!errors.categoryId}
                  aria-describedby={errors.categoryId ? 'subscription-category-error' : undefined}
                  fallbackLabel={subscription?.categoryId === field.value ? subscription.categoryName : undefined}
                  size="sm"
                  isLoading={categories.isLoading}
                  disabled={!!categories.error}
                />
              )}
            />
          </FormField>
          <FormField label="Amount" htmlFor="subscription-amount" required error={errors.amount?.message}>
            <input id="subscription-amount" type="number" min="0.01" step="0.01" inputMode="decimal" className={cn(inputClass, 'font-mono', errors.amount && fieldInvalidClass)} {...register('amount', { valueAsNumber: true })} />
            <p className="text-[11px] text-muted-foreground">Currency: {activeTenant.currency} (set by this workspace)</p>
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Frequency" htmlFor="subscription-frequency" required error={errors.frequency?.message}>
            <select id="subscription-frequency" className={inputClass} {...register('frequency')}>
              {SUBSCRIPTION_FREQUENCIES.map((value) => <option key={value} value={value}>{FREQUENCY_LABELS[value]}</option>)}
            </select>
          </FormField>
          {frequency === 'CUSTOM' && (
            <FormField label="Interval in days" htmlFor="subscription-custom-days" required error={errors.customIntervalDays?.message}>
              <input id="subscription-custom-days" type="number" min="1" step="1" className={cn(inputClass, errors.customIntervalDays && fieldInvalidClass)} {...register('customIntervalDays', { valueAsNumber: true })} />
            </FormField>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Next billing date" htmlFor="subscription-next-date" required error={errors.nextBillingDate?.message}>
            <input id="subscription-next-date" type="date" className={cn(inputClass, errors.nextBillingDate && fieldInvalidClass)} {...register('nextBillingDate')} />
          </FormField>
          <FormField label="End date" htmlFor="subscription-end-date" error={errors.endDate?.message}>
            <input id="subscription-end-date" type="date" min={nextBillingDate || undefined} className={cn(inputClass, errors.endDate && fieldInvalidClass)} {...register('endDate')} />
          </FormField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Reminder lead time" htmlFor="subscription-reminder" error={errors.reminderLeadDays?.message}>
            <input id="subscription-reminder" type="number" min="0" step="1" className={cn(inputClass, errors.reminderLeadDays && fieldInvalidClass)} {...register('reminderLeadDays', { valueAsNumber: true })} />
          </FormField>
          <FormField label="Payment method" htmlFor="subscription-payment" error={errors.paymentMethodId?.message}>
            <Controller name="paymentMethodId" control={control} render={({ field }) => (
              <PaymentMethodSelect id="subscription-payment" value={field.value} onChange={field.onChange} onBlur={field.onBlur} inputRef={field.ref} fallbackLabel={subscription?.paymentMethod} invalid={!!errors.paymentMethodId} />
            )} />
          </FormField>
        </div>
        <FormField label="Notes" htmlFor="subscription-notes" error={errors.notes?.message}>
          <textarea id="subscription-notes" rows={2} className={cn(inputClass, 'h-auto py-2', errors.notes && fieldInvalidClass)} {...register('notes')} />
        </FormField>
        <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting || categories.isLoading || !!categories.error || paymentMethods.isPending || !!paymentMethods.error || !paymentMethods.data?.some((method) => method.active && method.id === paymentMethodId)} className="gap-2">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {subscription ? 'Save changes' : 'Create subscription'}
          </Button>
        </div>
      </form>
    </SubscriptionDialog>
  )
}
