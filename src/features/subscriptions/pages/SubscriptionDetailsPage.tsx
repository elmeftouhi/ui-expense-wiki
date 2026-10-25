import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarClock, History, Pencil, RefreshCw, StopCircle } from 'lucide-react'
import { ApiClientError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { useActiveTenant } from '@/features/tenants'
import { formatTenantCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  usePauseSubscription,
  useResumeSubscription,
  useStopSubscription,
  useSubscription,
  useUpdateSubscription,
} from '../hooks/useSubscriptions'
import { SUBSCRIPTION_FREQUENCIES, type Subscription } from '../types'
import { SubscriptionFormModal } from '../components/SubscriptionFormModal'
import { ResumeSubscriptionModal } from '../components/ResumeSubscriptionModal'
import { SubscriptionStatusBadge } from '../components/SubscriptionStatusBadge'
import { SubscriptionDialog } from '../components/SubscriptionDialog'
import { SubscriptionPaymentsHistory } from '../components/SubscriptionPaymentsHistory'
import { GenerateNextPaymentButton } from '../components/GenerateNextPaymentButton'
import { BackfillPaymentModal } from '../components/BackfillPaymentModal'

const FREQUENCY_LABELS: Record<(typeof SUBSCRIPTION_FREQUENCIES)[number], string> = {
  DAILY: 'Daily', WEEKLY: 'Weekly', BIWEEKLY: 'Every two weeks', MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly', SEMIANNUAL: 'Every six months', ANNUAL: 'Annual',
  YEARLY: 'Yearly', CUSTOM: 'Custom interval',
}

function formatDateOnly(date: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
}

function StopConfirmation({ subscription, onClose, onConfirm }: {
  subscription: Subscription
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const confirm = async () => {
    setSaving(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (cause) {
      setError(getApiErrorMessage(cause, 'Could not stop subscription.'))
    } finally {
      setSaving(false)
    }
  }
  return (
    <SubscriptionDialog title="Stop subscription?" description="No future payments or reminders will be created. Existing expenses and history remain unchanged." onClose={onClose} dismissible={!saving} className="max-w-md">
      {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose} disabled={saving}>Keep subscription</Button>
        <Button variant="destructive" onClick={() => void confirm()} disabled={saving} className="gap-2">
          {saving && <RefreshCw className="h-4 w-4 animate-spin" />} Stop {subscription.name}
        </Button>
      </div>
    </SubscriptionDialog>
  )
}

export function SubscriptionDetailsPage() {
  const { activeTenant } = useActiveTenant()
  const { subscriptionId } = useParams<{ subscriptionId: string }>()
  return <SubscriptionDetailsContent key={`${activeTenant.id}:${subscriptionId}`} />
}

function SubscriptionDetailsContent() {
  const { activeTenant, canEdit } = useActiveTenant()
  const { subscriptionId: rawId } = useParams<{ subscriptionId: string }>()
  const parsedId = Number(rawId)
  const id = Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : undefined
  const toast = useToast()
  const query = useSubscription(id)
  const [editing, setEditing] = useState(false)
  const [resuming, setResuming] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [backfilling, setBackfilling] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const pause = usePauseSubscription()
  const resume = useResumeSubscription()
  const stop = useStopSubscription()
  const update = useUpdateSubscription()

  const runAction = async (label: string, operation: () => Promise<unknown>) => {
    setActionError(null)
    try {
      await operation()
      toast.success(`Subscription ${label}`, `The subscription was ${label.toLowerCase()}.`)
    } catch (error) {
      const message = getApiErrorMessage(error)
      setActionError(message)
      const action = label === 'paused' ? 'pause' : label === 'resumed' ? 'resume' : 'stop'
      toast.error(`Could not ${action} subscription`, message)
      throw error
    }
  }

  if (id === undefined || (query.error instanceof ApiClientError && query.error.status === 404)) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm"><Link to="/subscriptions"><ArrowLeft className="mr-1.5 h-4 w-4" /> Subscriptions</Link></Button>
        <Card className="border-dashed"><CardContent className="py-14 text-center">
          <h1 className="text-base font-semibold">Subscription not found</h1>
          <p className="mt-1 text-xs text-muted-foreground">It may have been removed or belongs to another workspace.</p>
        </CardContent></Card>
      </div>
    )
  }

  if (query.isLoading) {
    return <div role="status" aria-busy="true" className="space-y-4"><div className="h-8 w-64 animate-pulse rounded bg-muted" /><div className="h-40 animate-pulse rounded-xl bg-muted" /><div className="h-64 animate-pulse rounded-xl bg-muted" /></div>
  }

  if (query.isError || !query.data) {
    return (
      <Card role="alert" className="border-destructive/30"><CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <h1 className="text-sm font-semibold">Could not load subscription</h1>
        <p className="text-xs text-muted-foreground">{getApiErrorMessage(query.error)}</p>
        <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button>
      </CardContent></Card>
    )
  }

  const subscription = query.data
  const terminal = subscription.status === 'STOPPED' || subscription.status === 'ENDED'
  const canStop = subscription.status === 'ACTIVE' || subscription.status === 'PAUSED'
  const money = (amount: number) => formatTenantCurrency(amount, activeTenant)

  const handleUpdate = async (payload: Parameters<typeof update.mutateAsync>[0]['payload']) => {
    try {
      await update.mutateAsync({ id: subscription.id, payload })
      toast.success('Subscription updated', 'Changes apply to future payments.')
    } catch (error) {
      toast.error('Could not update subscription', getApiErrorMessage(error))
      throw error
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3 border-b border-border/40 pb-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2"><Link to="/subscriptions"><ArrowLeft className="mr-1.5 h-4 w-4" /> All subscriptions</Link></Button>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight">{subscription.name}</h1>
              <SubscriptionStatusBadge status={subscription.status} />
            </div>
            {subscription.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subscription.description}</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && <Button variant="outline" size="sm" onClick={() => setBackfilling(true)}><History className="mr-1.5 h-4 w-4" /> Add historical payment</Button>}
            {canEdit && !terminal && subscription.status === 'ACTIVE' && (
              <Button variant="outline" size="sm" onClick={() => { void runAction('paused', () => pause.mutateAsync(subscription.id)).catch(() => undefined) }} disabled={pause.isPending}>Pause</Button>
            )}
            {canEdit && subscription.status === 'PAUSED' && <Button variant="outline" size="sm" onClick={() => setResuming(true)}>Resume</Button>}
            {canEdit && canStop && <Button variant="outline" size="sm" onClick={() => setStopping(true)}><StopCircle className="mr-1.5 h-4 w-4" /> Stop</Button>}
            {canEdit && !terminal && <Button size="sm" onClick={() => setEditing(true)}><Pencil className="mr-1.5 h-4 w-4" /> Edit</Button>}
          </div>
        </div>
      </header>

      {actionError && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{actionError}</p>}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm"><CalendarClock className="h-4 w-4 text-primary" /> Recurring commitment</CardTitle>
          {canEdit && <div className="pt-2"><GenerateNextPaymentButton subscriptionId={subscription.id} status={subscription.status} /></div>}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Amount', money(subscription.amount)],
              ['Category', subscription.categoryName],
              ['Frequency', subscription.frequency === 'CUSTOM' ? `Every ${subscription.customIntervalDays} days` : FREQUENCY_LABELS[subscription.frequency]],
              ['Next billing date', formatDateOnly(subscription.nextBillingDate, activeTenant.locale)],
              ['End date', subscription.endDate ? formatDateOnly(subscription.endDate, activeTenant.locale) : 'No end date'],
              ['Reminder', subscription.reminderLeadDays === 0 ? 'Off' : `${subscription.reminderLeadDays} days before`],
              ['Payment method', subscription.paymentMethod || 'Not specified'],
              ['Notes', subscription.notes || 'No notes'],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-lg border border-border/60 bg-background p-3">
                <dt className="text-[11px] text-muted-foreground">{label}</dt>
                <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <SubscriptionPaymentsHistory subscriptionId={subscription.id} />

      {editing && <SubscriptionFormModal subscription={subscription} onClose={() => setEditing(false)} onSubmit={handleUpdate} />}
      {resuming && <ResumeSubscriptionModal onClose={() => setResuming(false)} onSubmit={(nextBillingDate) => runAction('resumed', () => resume.mutateAsync({ id: subscription.id, nextBillingDate }))} />}
      {stopping && <StopConfirmation subscription={subscription} onClose={() => setStopping(false)} onConfirm={() => runAction('stopped', () => stop.mutateAsync(subscription.id))} />}
      {backfilling && <BackfillPaymentModal subscriptionId={subscription.id} onClose={() => setBackfilling(false)} />}
    </div>
  )
}
