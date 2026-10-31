import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ChevronDown, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useActiveTenant } from '@/features/tenants'
import { useCategoryOptions } from '@/features/budgets/hooks/useCategoryOptions'
import { getCurrencySymbol } from '@/features/budgets/utils/currency'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { AmountInput, FormField, fieldInputClass, fieldInvalidClass } from '@/features/budgets/components/FormControls'
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
import { FREQUENCY_LABELS } from '../utils/subscriptionFormatters'
import { SubscriptionDialog } from './SubscriptionDialog'

interface SubscriptionFormModalProps {
  subscription?: Subscription | null
  onClose: () => void
  onSubmit: (values: ReturnType<typeof toSubscriptionPayload>) => Promise<void>
}

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

function hasOptionalDetails(subscription?: Subscription | null): boolean {
  if (!subscription) return false
  return Boolean(
    subscription.description?.trim() ||
    subscription.endDate ||
    subscription.notes?.trim() ||
    subscription.reminderLeadDays !== DEFAULT_SUBSCRIPTION_FORM_VALUES.reminderLeadDays,
  )
}

export function SubscriptionFormModal({ subscription, onClose, onSubmit }: SubscriptionFormModalProps) {
  const { activeTenant } = useActiveTenant()
  return (
    <SubscriptionFormContent
      key={activeTenant.id}
      subscription={subscription}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

function SubscriptionFormContent({ subscription, onClose, onSubmit }: SubscriptionFormModalProps) {
  const { activeTenant } = useActiveTenant()
  const categories = useCategoryOptions()
  const paymentMethods = usePaymentMethods()
  const currencySymbol = getCurrencySymbol(activeTenant.currency, activeTenant.locale)
  const [serverError, setServerError] = useState<string | null>(null)
  const [showOptional, setShowOptional] = useState(() => hasOptionalDetails(subscription))

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
  const nextBillingDate = useWatch({ control, name: 'nextBillingDate' })

  useEffect(() => {
    if (!subscription && !getFieldState('paymentMethodId').isDirty && paymentMethodId === undefined) {
      const defaultMethod = paymentMethods.data?.find((method) => method.active && method.isDefault)
      if (defaultMethod) setValue('paymentMethodId', defaultMethod.id)
    }
  }, [subscription, paymentMethods.data, paymentMethodId, getFieldState, setValue])

  const hasOptionalError = Boolean(
    errors.description || errors.endDate || errors.reminderLeadDays || errors.notes,
  )
  const optionalExpanded = showOptional || hasOptionalError

  const submit = async (values: SubscriptionFormValues) => {
    setServerError(null)
    if (
      paymentMethods.isPending ||
      paymentMethods.error ||
      !paymentMethods.data?.some((method) => method.active && method.id === values.paymentMethodId)
    ) {
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
      title={subscription ? 'Edit subscription' : 'New subscription'}
      onClose={onClose}
      dismissible={!isSubmitting}
      className="sm:max-w-xl"
    >
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      {categories.error && (
        <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-xs text-destructive">
          <p>Could not load categories. {getApiErrorMessage(categories.error)}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void categories.refetch()}>
            Retry categories
          </Button>
        </div>
      )}

      <form noValidate onSubmit={handleSubmit(submit)} className="space-y-4">
        <FormField label="Name" htmlFor="subscription-name" required error={errors.name?.message}>
          <input
            id="subscription-name"
            autoFocus
            maxLength={120}
            placeholder="e.g. Figma, AWS, Spotify"
            className={cn(fieldInputClass, errors.name && fieldInvalidClass)}
            {...register('name')}
          />
        </FormField>

        <div className="grid gap-3.5 sm:grid-cols-2">
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
            <AmountInput
              id="subscription-amount"
              prefix={currencySymbol}
              min="0.01"
              placeholder="0.00"
              invalid={!!errors.amount}
              {...register('amount', { valueAsNumber: true })}
            />
          </FormField>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <FormField label="Frequency" htmlFor="subscription-frequency" required error={errors.frequency?.message}>
            <select id="subscription-frequency" className={fieldInputClass} {...register('frequency')}>
              {SUBSCRIPTION_FREQUENCIES.map((value) => (
                <option key={value} value={value}>
                  {FREQUENCY_LABELS[value]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Next billing date"
            htmlFor="subscription-next-date"
            required
            error={errors.nextBillingDate?.message}
          >
            <input
              id="subscription-next-date"
              type="date"
              className={cn(fieldInputClass, 'font-mono tabular-nums', errors.nextBillingDate && fieldInvalidClass)}
              {...register('nextBillingDate')}
            />
          </FormField>
        </div>

        {frequency === 'CUSTOM' && (
          <FormField
            label="Interval in days"
            htmlFor="subscription-custom-days"
            required
            error={errors.customIntervalDays?.message}
          >
            <input
              id="subscription-custom-days"
              type="number"
              min="1"
              step="1"
              placeholder="e.g. 30"
              className={cn(fieldInputClass, 'font-mono tabular-nums', errors.customIntervalDays && fieldInvalidClass)}
              {...register('customIntervalDays', { valueAsNumber: true })}
            />
          </FormField>
        )}

        <FormField label="Payment method" htmlFor="subscription-payment" error={errors.paymentMethodId?.message}>
          <Controller
            name="paymentMethodId"
            control={control}
            render={({ field }) => (
              <PaymentMethodSelect
                id="subscription-payment"
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                inputRef={field.ref}
                fallbackLabel={subscription?.paymentMethod}
                invalid={!!errors.paymentMethodId}
              />
            )}
          />
        </FormField>

        {/* Progressive disclosure for secondary fields */}
        <div className="rounded-xl border border-border/60 bg-muted/20">
          <button
            type="button"
            aria-expanded={optionalExpanded}
            onClick={() => setShowOptional((prev) => !prev)}
            className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <span>More options (end date, reminder, notes)</span>
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', optionalExpanded && 'rotate-180')}
            />
          </button>

          {optionalExpanded && (
            <div className="space-y-3.5 border-t border-border/60 p-3.5">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <FormField label="End date" htmlFor="subscription-end-date" error={errors.endDate?.message}>
                  <input
                    id="subscription-end-date"
                    type="date"
                    min={nextBillingDate || undefined}
                    className={cn(fieldInputClass, 'font-mono tabular-nums', errors.endDate && fieldInvalidClass)}
                    {...register('endDate')}
                  />
                </FormField>

                <FormField
                  label="Reminder lead time (days)"
                  htmlFor="subscription-reminder"
                  error={errors.reminderLeadDays?.message}
                >
                  <input
                    id="subscription-reminder"
                    type="number"
                    min="0"
                    step="1"
                    className={cn(fieldInputClass, 'font-mono tabular-nums', errors.reminderLeadDays && fieldInvalidClass)}
                    {...register('reminderLeadDays', { valueAsNumber: true })}
                  />
                </FormField>
              </div>

              <FormField label="Description" htmlFor="subscription-description" error={errors.description?.message}>
                <input
                  id="subscription-description"
                  type="text"
                  maxLength={1000}
                  placeholder="Optional summary…"
                  className={cn(fieldInputClass, errors.description && fieldInvalidClass)}
                  {...register('description')}
                />
              </FormField>

              <FormField label="Notes" htmlFor="subscription-notes" error={errors.notes?.message}>
                <textarea
                  id="subscription-notes"
                  rows={2}
                  placeholder="Contract terms, seat count, or billing notes…"
                  className={cn(fieldInputClass, 'h-auto resize-none py-2', errors.notes && fieldInvalidClass)}
                  {...register('notes')}
                />
              </FormField>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="h-9">
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={
              isSubmitting ||
              categories.isLoading ||
              !!categories.error ||
              paymentMethods.isPending ||
              !!paymentMethods.error ||
              !paymentMethods.data?.some((method) => method.active && method.id === paymentMethodId)
            }
            className="h-9 gap-1.5"
          >
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {subscription ? 'Save changes' : 'Create subscription'}
          </Button>
        </div>
      </form>
    </SubscriptionDialog>
  )
}
