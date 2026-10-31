import React, { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Info, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { Budget, BudgetCreateRequest, BudgetPeriodicity } from '../types'
import {
  BUDGET_DESCRIPTION_MAX,
  BUDGET_NAME_MAX,
  DEFAULT_BUDGET_FORM_VALUES,
  budgetFormSchema,
  toBudgetPayload,
  type BudgetFormValues,
} from '../schemas/budgetSchema'
import { PERIODICITY_LABELS, getWarningAmount } from '../utils/budgetMath'
import { getCurrencySymbol } from '../utils/currency'
import type { CategoryOption } from '../utils/categoryOptions'
import { BudgetDialog } from './BudgetDialog'
import { CategoryMultiSelect } from './CategoryMultiSelect'
import { AmountInput, FormField, WarningTypeToggle, fieldInputClass, fieldInvalidClass } from './FormControls'

export interface BudgetFormModalProps {
  isOpen: boolean
  onClose: () => void
  /** Should reject on failure; the modal surfaces the error inline and stays open. */
  onSubmit: (payload: BudgetCreateRequest) => Promise<void>
  budget?: Budget | null
  categoryOptions: CategoryOption[]
  categoriesLoading?: boolean
  categoriesError?: Error | null
  onRetryCategories?: () => void
  currency: string
  locale?: string
}

const PERIODICITIES: BudgetPeriodicity[] = ['MONTHLY', 'QUARTERLY', 'ANNUAL']

function toFormValues(budget: Budget): BudgetFormValues {
  return {
    name: budget.name,
    description: budget.description ?? '',
    periodicity: budget.periodicity,
    allocatedAmount: budget.allocatedAmount,
    warningType: budget.warningType,
    warningThreshold: budget.warningThreshold,
    categoryIds: [...budget.categoryIds],
    active: budget.active,
  }
}

const describedBy = (id: string, hasError: boolean, hasHint = false) =>
  hasError ? `${id}-error` : hasHint ? `${id}-hint` : undefined

const BudgetFormInner: React.FC<Omit<BudgetFormModalProps, 'isOpen'>> = ({
  onClose,
  onSubmit,
  budget,
  categoryOptions,
  categoriesLoading,
  categoriesError,
  onRetryCategories,
  currency,
  locale,
}) => {
  const isEditing = !!budget
  const [serverError, setServerError] = useState<string | null>(null)
  const currencySymbol = getCurrencySymbol(currency, locale)

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BudgetFormValues>({
    resolver: zodResolver(budgetFormSchema),
    defaultValues: budget ? toFormValues(budget) : DEFAULT_BUDGET_FORM_VALUES,
    mode: 'onTouched',
  })

  const [warningType, allocatedAmount, warningThreshold] = useWatch({
    control,
    name: ['warningType', 'allocatedAmount', 'warningThreshold'],
  })

  const previewWarningAt =
    Number.isFinite(allocatedAmount) && allocatedAmount > 0 && Number.isFinite(warningThreshold)
      ? getWarningAmount(allocatedAmount, warningType, warningThreshold)
      : null

  const money = (n: number) => formatCurrency(n, { currency, locale })

  const onValid = async (values: BudgetFormValues) => {
    setServerError(null)
    try {
      await onSubmit(toBudgetPayload(values))
      onClose()
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Failed to save budget.'))
    }
  }

  return (
    <BudgetDialog
      title={isEditing ? 'Edit budget' : 'New budget'}
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

      <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-4">
        <FormField label="Budget name" htmlFor="budget-name" required error={errors.name?.message}>
          <input
            id="budget-name"
            type="text"
            autoFocus
            maxLength={BUDGET_NAME_MAX}
            placeholder="e.g. Cloud & SaaS"
            aria-invalid={!!errors.name || undefined}
            aria-describedby={describedBy('budget-name', !!errors.name)}
            className={cn(fieldInputClass, errors.name && fieldInvalidClass)}
            {...register('name')}
          />
        </FormField>

        <FormField label="Description" htmlFor="budget-description" error={errors.description?.message}>
          <textarea
            id="budget-description"
            rows={2}
            maxLength={BUDGET_DESCRIPTION_MAX}
            placeholder="Optional notes…"
            aria-invalid={!!errors.description || undefined}
            aria-describedby={describedBy('budget-description', !!errors.description)}
            className={cn(fieldInputClass, 'h-auto resize-none py-2', errors.description && fieldInvalidClass)}
            {...register('description')}
          />
        </FormField>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <FormField label="Periodicity" htmlFor="budget-periodicity" required>
            <select id="budget-periodicity" className={fieldInputClass} {...register('periodicity')}>
              {PERIODICITIES.map((p) => (
                <option key={p} value={p}>
                  {PERIODICITY_LABELS[p]}
                </option>
              ))}
            </select>
          </FormField>

          <FormField
            label="Allocated amount"
            htmlFor="budget-allocated"
            required
            error={errors.allocatedAmount?.message}
          >
            <AmountInput
              id="budget-allocated"
              prefix={currencySymbol}
              min="0.01"
              placeholder="5000.00"
              invalid={!!errors.allocatedAmount}
              aria-describedby={describedBy('budget-allocated', !!errors.allocatedAmount)}
              {...register('allocatedAmount', { valueAsNumber: true })}
            />
          </FormField>
        </div>

        <div className="space-y-2.5 rounded-xl border border-border/60 bg-muted/25 p-3">
          <div className="grid gap-3.5 sm:grid-cols-2">
            <FormField label="Warning type" htmlFor="budget-warning-type">
              <Controller
                control={control}
                name="warningType"
                render={({ field }) => (
                  <WarningTypeToggle
                    id="budget-warning-type"
                    value={field.value}
                    onChange={field.onChange}
                    currencySymbol={currencySymbol}
                  />
                )}
              />
            </FormField>

            <FormField
              label="Warning threshold"
              htmlFor="budget-warning-threshold"
              required
              error={errors.warningThreshold?.message}
            >
              <AmountInput
                id="budget-warning-threshold"
                prefix={warningType === 'PERCENTAGE' ? '%' : currencySymbol}
                min="0"
                max={warningType === 'PERCENTAGE' ? '100' : undefined}
                invalid={!!errors.warningThreshold}
                aria-describedby={describedBy('budget-warning-threshold', !!errors.warningThreshold)}
                {...register('warningThreshold', { valueAsNumber: true })}
              />
            </FormField>
          </div>
          {previewWarningAt !== null && !errors.warningThreshold && (
            <p data-testid="warning-preview" className="text-[11px] text-muted-foreground">
              Warns at <span className="font-mono font-semibold text-foreground">{money(previewWarningAt)}</span> spent
            </p>
          )}
        </div>

        {categoriesError && (
          <div role="alert" className="space-y-2 rounded-lg border border-destructive/30 p-3 text-xs text-destructive">
            <p>Could not load categories. {getApiErrorMessage(categoriesError)}</p>
            <Button type="button" variant="outline" size="sm" onClick={onRetryCategories}>
              Retry categories
            </Button>
          </div>
        )}

        <FormField
          label="Tracked categories"
          htmlFor="budget-categories"
          required
          error={errors.categoryIds?.message}
        >
          <Controller
            control={control}
            name="categoryIds"
            render={({ field }) => (
              <CategoryMultiSelect
                id="budget-categories"
                options={categoryOptions}
                value={field.value}
                onChange={(next) => {
                  field.onChange(next)
                  field.onBlur()
                }}
                isLoading={categoriesLoading}
                disabled={!!categoriesError || categoriesLoading}
                invalid={!!errors.categoryIds}
                aria-describedby={describedBy('budget-categories', !!errors.categoryIds)}
              />
            )}
          />
        </FormField>

        {isEditing && (
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Info className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span>Defaults apply to future periods. Adjust the active period from the budget details page.</span>
          </p>
        )}

        <Controller
          control={control}
          name="active"
          render={({ field }) => (
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border/60 px-3 py-2.5">
              <div>
                <p id="budget-active-label" className="text-xs font-semibold text-foreground">
                  Active
                </p>
                <p className="text-[11px] text-muted-foreground">Pause to stop tracking new expenses</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={field.value}
                aria-labelledby="budget-active-label"
                onClick={() => field.onChange(!field.value)}
                className={cn(
                  'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
                  field.value ? 'bg-primary' : 'bg-muted-foreground/30',
                )}
              >
                <span
                  className={cn(
                    'inline-block h-4 w-4 rounded-full bg-background shadow transition-transform',
                    field.value ? 'translate-x-4.5' : 'translate-x-0.5',
                  )}
                />
              </button>
            </div>
          )}
        />

        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="h-9">
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || categoriesLoading || !!categoriesError}
            className="h-9 gap-1.5"
          >
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isEditing ? 'Save changes' : 'Create budget'}
          </Button>
        </div>
      </form>
    </BudgetDialog>
  )
}

/** Create / edit budget dialog. Remounts per budget so the form always starts from fresh values. */
export const BudgetFormModal: React.FC<BudgetFormModalProps> = ({ isOpen, ...props }) => {
  if (!isOpen) return null
  return <BudgetFormInner key={props.budget?.id ?? 'new'} {...props} />
}
