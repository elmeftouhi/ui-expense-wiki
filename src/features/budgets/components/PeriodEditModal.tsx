import React, { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, CalendarRange, Info, Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { BudgetPeriod, BudgetPeriodUpdateRequest } from '../types'
import { periodUpdateSchema, toPeriodPayload, type PeriodUpdateFormValues } from '../schemas/budgetSchema'
import { summarizePeriod } from '../utils/budgetMath'
import { getCurrencySymbol } from '../utils/currency'
import { BudgetDialog } from './BudgetDialog'
import { BudgetHealthBadge, PeriodStatusBadge } from './BudgetStatusBadges'
import { AmountInput, FormField, WarningTypeToggle } from './FormControls'

export interface PeriodEditModalProps {
  /** Period being adjusted; `null` closes the modal. */
  period: BudgetPeriod | null
  periodLabel: string
  onClose: () => void
  onSubmit: (periodId: number, payload: BudgetPeriodUpdateRequest) => Promise<void>
  currency: string
  locale?: string
}

const PeriodEditInner: React.FC<Omit<PeriodEditModalProps, 'period'> & { period: BudgetPeriod }> = ({
  period,
  periodLabel,
  onClose,
  onSubmit,
  currency,
  locale,
}) => {
  const [serverError, setServerError] = useState<string | null>(null)
  const currencySymbol = getCurrencySymbol(currency, locale)
  const money = (n: number) => formatCurrency(n, { currency, locale })

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PeriodUpdateFormValues>({
    resolver: zodResolver(periodUpdateSchema),
    defaultValues: {
      allocatedAmount: period.allocatedAmount,
      warningType: period.warningType,
      warningThreshold: period.warningThreshold,
    },
    mode: 'onTouched',
  })

  const [allocatedAmount, warningType, warningThreshold] = useWatch({
    control,
    name: ['allocatedAmount', 'warningType', 'warningThreshold'],
  })

  const preview =
    Number.isFinite(allocatedAmount) && allocatedAmount > 0 && Number.isFinite(warningThreshold)
      ? summarizePeriod({ ...period, allocatedAmount, warningType, warningThreshold })
      : null

  const onValid = async (values: PeriodUpdateFormValues) => {
    setServerError(null)
    try {
      await onSubmit(period.id, toPeriodPayload(values))
      onClose()
    } catch (err) {
      setServerError(getApiErrorMessage(err, 'Failed to update period.'))
    }
  }

  return (
    <BudgetDialog
      title={`Adjust period · ${periodLabel}`}
      description="Changes apply to this period instance only. Spend is recalculated by the backend from linked expenses."
      icon={<CalendarRange className="h-5 w-5" />}
      onClose={onClose}
      dismissible={!isSubmitting}
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <PeriodStatusBadge status={period.status} />
        <span>
          Spent so far: <span className="font-mono font-semibold text-foreground">{money(period.spentAmount)}</span>
        </span>
      </div>

      {period.status === 'CLOSED' && (
        <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.07] p-2.5 text-[11px] text-amber-800 dark:text-amber-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          This period is closed. Adjusting it changes historical reporting only.
        </p>
      )}

      {serverError && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onValid)} noValidate className="space-y-4">
        <FormField label="Allocated amount" htmlFor="period-allocated" required error={errors.allocatedAmount?.message}>
          <AmountInput
            id="period-allocated"
            prefix={currencySymbol}
            min="0.01"
            autoFocus
            invalid={!!errors.allocatedAmount}
            aria-describedby={errors.allocatedAmount ? 'period-allocated-error' : undefined}
            {...register('allocatedAmount', { valueAsNumber: true })}
          />
        </FormField>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Warning type" htmlFor="period-warning-type">
            <Controller
              control={control}
              name="warningType"
              render={({ field }) => (
                <WarningTypeToggle
                  id="period-warning-type"
                  value={field.value}
                  onChange={field.onChange}
                  currencySymbol={currencySymbol}
                />
              )}
            />
          </FormField>
          <FormField
            label="Warning threshold"
            htmlFor="period-warning-threshold"
            required
            error={errors.warningThreshold?.message}
          >
            <AmountInput
              id="period-warning-threshold"
              prefix={warningType === 'PERCENTAGE' ? '%' : currencySymbol}
              min="0"
              invalid={!!errors.warningThreshold}
              aria-describedby={errors.warningThreshold ? 'period-warning-threshold-error' : undefined}
              {...register('warningThreshold', { valueAsNumber: true })}
            />
          </FormField>
        </div>

        {preview && (
          <div data-testid="period-preview" className="grid grid-cols-3 gap-2 rounded-xl border border-border/60 bg-muted/30 p-3 text-[11px]">
            <div>
              <p className="text-muted-foreground">Remaining</p>
              <p className={cn('font-mono font-semibold', preview.remaining < 0 ? 'text-destructive' : 'text-foreground')}>
                {money(preview.remaining)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Warns at</p>
              <p className="font-mono font-semibold text-foreground">{money(preview.warningAt)}</p>
            </div>
            <div className="flex flex-col items-start gap-1">
              <p className="text-muted-foreground">Status after save</p>
              <BudgetHealthBadge health={preview.health} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="h-9">
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting} className="h-9 gap-1.5">
            {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save period
          </Button>
        </div>
      </form>
    </BudgetDialog>
  )
}

/** Dialog for PATCH /v1/budgets/{id}/periods/{periodId}. */
export const PeriodEditModal: React.FC<PeriodEditModalProps> = ({ period, ...props }) => {
  if (!period) return null
  return <PeriodEditInner key={period.id} period={period} {...props} />
}
