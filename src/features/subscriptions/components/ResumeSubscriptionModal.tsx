import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { FormField, fieldInputClass, fieldInvalidClass } from '@/features/budgets/components/FormControls'
import { SubscriptionDialog } from './SubscriptionDialog'

const resumeSchema = z.object({
  nextBillingDate: z.iso.date({ error: 'Choose the next billing date.' }),
})
type ResumeValues = z.infer<typeof resumeSchema>

export function ResumeSubscriptionModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (nextBillingDate: string) => Promise<void>
}) {
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResumeValues>({
    resolver: zodResolver(resumeSchema),
    defaultValues: { nextBillingDate: '' },
  })

  const submit = async ({ nextBillingDate }: ResumeValues) => {
    setServerError(null)
    try {
      await onSubmit(nextBillingDate)
      onClose()
    } catch (error) {
      setServerError(getApiErrorMessage(error, 'Could not resume subscription.'))
    }
  }

  return (
    <SubscriptionDialog
      title="Resume subscription"
      description="Missed dates while paused won't be billed."
      onClose={onClose}
      dismissible={!isSubmitting}
      className="sm:max-w-md"
    >
      {serverError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {serverError}
        </p>
      )}
      <form noValidate onSubmit={handleSubmit(submit)} className="space-y-4">
        <FormField label="Next billing date" htmlFor="resume-next-date" required error={errors.nextBillingDate?.message}>
          <input
            id="resume-next-date"
            autoFocus
            type="date"
            className={cn(fieldInputClass, 'font-mono tabular-nums', errors.nextBillingDate && fieldInvalidClass)}
            {...register('nextBillingDate')}
          />
        </FormField>
        <div className="flex justify-end gap-2 border-t border-border/60 pt-3">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="h-9">
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting} className="h-9 gap-1.5">
            {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Resume subscription
          </Button>
        </div>
      </form>
    </SubscriptionDialog>
  )
}
