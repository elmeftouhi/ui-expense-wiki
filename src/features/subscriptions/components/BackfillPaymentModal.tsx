import { useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Info, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { FormField, fieldInputClass, fieldInvalidClass } from '@/features/budgets/components/FormControls'
import { useBackfillSubscriptionPayment } from '../hooks/useSubscriptions'
import {
  createBackfillPaymentSchema,
  localToday,
  toBackfillPayload,
  type BackfillPaymentValues,
} from '../schemas/backfillPaymentSchema'
import { SubscriptionDialog } from './SubscriptionDialog'

export function BackfillPaymentModal({ subscriptionId, onClose }: {
  subscriptionId: number
  onClose: () => void
}) {
  const toast = useToast()
  const backfill = useBackfillSubscriptionPayment()
  const [serverError, setServerError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [schema] = useState(() => createBackfillPaymentSchema())
  const today = localToday()
  const {
    register,
    handleSubmit,
    setValue,
    getFieldState,
    formState: { errors, isSubmitting },
  } = useForm<BackfillPaymentValues>({
    resolver: zodResolver(schema),
    defaultValues: { scheduledBillingDate: '', paidDate: '' },
  })
  const busy = isSubmitting || backfill.isPending

  const submit = async (values: BackfillPaymentValues) => {
    setServerError(null)
    setNotice(null)
    try {
      const result = await backfill.mutateAsync({ subscriptionId, payload: toBackfillPayload(values) })
      if (result.generated) {
        toast.success('Historical payment added', result.message || 'The payment and its expense were added to the history.')
        onClose()
      } else if (result.alreadyExists) {
        toast.info('Payment already exists', result.message || 'A payment for this billing date already exists.')
        onClose()
      } else {
        const message = result.message || 'The payment was not added.'
        setNotice(message)
        toast.info('Payment not added', message)
      }
    } catch (error) {
      const message = getApiErrorMessage(error, 'Could not add the historical payment.')
      setServerError(message)
      toast.error('Could not add historical payment', message)
    }
  }

  // Keep paid date in step with the scheduled date until the user edits it themselves.
  const scheduledField = register('scheduledBillingDate', {
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      if (!getFieldState('paidDate').isDirty) {
        setValue('paidDate', event.target.value)
      }
    },
  })
  const paidField = register('paidDate')

  return (
    <SubscriptionDialog
      title="Add historical payment"
      description="Record a payment that already happened, for example when importing an existing subscription."
      onClose={onClose}
      dismissible={!busy}
    >
      <p className="flex gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>Use this for past payments or imports only. A linked expense is created for the billing date, and the subscription's next billing date is kept in sync.</span>
      </p>
      {serverError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{serverError}</p>}
      {notice && <p role="status" className="rounded-lg border border-border/60 bg-muted/40 p-3 text-xs">{notice}</p>}
      <form noValidate onSubmit={handleSubmit(submit)} className="space-y-4">
        <FormField label="Scheduled billing date" htmlFor="backfill-scheduled-date" required error={errors.scheduledBillingDate?.message} hint="Today or earlier.">
          <input
            id="backfill-scheduled-date"
            autoFocus
            type="date"
            max={today}
            aria-invalid={errors.scheduledBillingDate ? true : undefined}
            aria-describedby={errors.scheduledBillingDate ? 'backfill-scheduled-date-error' : 'backfill-scheduled-date-hint'}
            className={cn(fieldInputClass, errors.scheduledBillingDate && fieldInvalidClass)}
            {...scheduledField}
          />
        </FormField>
        <FormField label="Paid date" htmlFor="backfill-paid-date" error={errors.paidDate?.message} hint="Optional. Prefilled with the scheduled billing date.">
          <input
            id="backfill-paid-date"
            type="date"
            aria-invalid={errors.paidDate ? true : undefined}
            aria-describedby={errors.paidDate ? 'backfill-paid-date-error' : 'backfill-paid-date-hint'}
            className={cn(fieldInputClass, errors.paidDate && fieldInvalidClass)}
            {...paidField}
          />
        </FormField>
        <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" disabled={busy} aria-busy={busy} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />}
            {busy ? 'Adding payment...' : 'Add payment'}
          </Button>
        </div>
      </form>
    </SubscriptionDialog>
  )
}
