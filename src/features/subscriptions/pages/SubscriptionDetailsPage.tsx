import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, History, Pencil, RefreshCw, SearchX, ShieldAlert, StopCircle } from 'lucide-react'
import { ApiClientError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { useActiveTenant } from '@/features/tenants'
import { useCategoryOptions } from '@/features/budgets/hooks/useCategoryOptions'
import { CategoryIcon } from '@/features/categories/components/CategoryIcon'
import { formatTenantCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import {
  usePauseSubscription,
  useResumeSubscription,
  useStopSubscription,
  useSubscription,
  useUpdateSubscription,
} from '../hooks/useSubscriptions'
import type { Subscription } from '../types'
import { annualCost } from '../utils/recurringCosts'
import { formatDateOnly, formatFrequency, getBillingTiming } from '../utils/subscriptionFormatters'
import { SubscriptionFormModal } from '../components/SubscriptionFormModal'
import { ResumeSubscriptionModal } from '../components/ResumeSubscriptionModal'
import { SubscriptionStatusBadge } from '../components/SubscriptionStatusBadge'
import { SubscriptionDialog } from '../components/SubscriptionDialog'
import { SubscriptionPaymentsHistory } from '../components/SubscriptionPaymentsHistory'
import { GenerateNextPaymentButton } from '../components/GenerateNextPaymentButton'
import { BackfillPaymentModal } from '../components/BackfillPaymentModal'

const BackLink = () => (
  <Button
    asChild
    variant="ghost"
    size="sm"
    className="-ml-2 h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
  >
    <Link to="/subscriptions">
      <ArrowLeft className="h-3.5 w-3.5" /> Subscriptions
    </Link>
  </Button>
)

function StopConfirmation({
  subscription,
  onClose,
  onConfirm,
}: {
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
    <SubscriptionDialog
      title="Stop subscription?"
      description="Future billing stops. Past payments and expenses stay unchanged."
      onClose={onClose}
      dismissible={!saving}
      className="sm:max-w-md"
    >
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onClose} disabled={saving} className="h-9">
          Keep subscription
        </Button>
        <Button variant="destructive" size="sm" onClick={() => void confirm()} disabled={saving} className="h-9 gap-1.5">
          {saving && <RefreshCw className="h-3.5 w-3.5 animate-spin" />} Stop {subscription.name}
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
  const categories = useCategoryOptions()
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
        <BackLink />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <SearchX className="h-7 w-7 text-muted-foreground" />
            <h1 className="text-base font-semibold text-foreground">Subscription not found</h1>
            <p className="max-w-xs text-xs text-muted-foreground">
              It may have been removed or belongs to another workspace.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (query.isLoading) {
    return (
      <div role="status" aria-busy="true" className="space-y-5">
        <BackLink />
        <div className="h-7 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
        <div className="h-60 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (query.isError || !query.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card role="alert" className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-7 w-7 text-destructive" />
            <h1 className="text-sm font-semibold text-foreground">Could not load subscription</h1>
            <p className="text-xs text-muted-foreground">{getApiErrorMessage(query.error)}</p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()} className="text-xs">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const subscription = query.data
  const terminal = subscription.status === 'STOPPED' || subscription.status === 'ENDED'
  const canStop = subscription.status === 'ACTIVE' || subscription.status === 'PAUSED'
  const money = (amount: number) => formatTenantCurrency(amount, activeTenant)
  const timing = getBillingTiming(subscription)
  const category = categories.byId.get(subscription.categoryId)
  const frequencyText = formatFrequency(subscription.frequency, subscription.customIntervalDays)

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
    <div className="space-y-5">
      {/* Compact Header */}
      <header className="space-y-1.5">
        <BackLink />
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {subscription.name}
              </h1>
              <SubscriptionStatusBadge status={subscription.status} />
            </div>
            {subscription.description && (
              <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{subscription.description}</p>
            )}
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {!terminal && subscription.status === 'ACTIVE' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void runAction('paused', () => pause.mutateAsync(subscription.id)).catch(() => undefined)
                  }}
                  disabled={pause.isPending}
                  className="h-8 text-xs sm:h-9"
                >
                  Pause
                </Button>
              )}
              {subscription.status === 'PAUSED' && (
                <Button variant="outline" size="sm" onClick={() => setResuming(true)} className="h-8 text-xs sm:h-9">
                  Resume
                </Button>
              )}
              {canStop && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setStopping(true)}
                  className="h-8 gap-1.5 text-xs sm:h-9"
                >
                  <StopCircle className="h-3.5 w-3.5" />
                  Stop
                </Button>
              )}
              {!terminal && (
                <Button size="sm" onClick={() => setEditing(true)} className="h-8 gap-1.5 text-xs sm:h-9">
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      {actionError && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          {actionError}
        </p>
      )}

      {/* Unified Schedule Ledger Sheet */}
      <section className="overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs">
        <div className="divide-y divide-border/60 lg:grid lg:grid-cols-12 lg:divide-x lg:divide-y-0">
          {/* Primary Billing & Next Date (7 cols) */}
          <div className="space-y-4 p-4 sm:p-5 lg:col-span-7">
            <div>
              <span className="block text-xs font-medium text-muted-foreground">{frequencyText} billing</span>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground sm:text-3xl">
                  {money(subscription.amount)}
                </span>
                {subscription.frequency !== 'MONTHLY' && (
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    ({money(annualCost(subscription) / 12)} / month)
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-3.5">
              <div>
                <span className="block text-[11px] text-muted-foreground">Next billing date</span>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <time
                    dateTime={subscription.nextBillingDate}
                    className="font-mono text-sm font-semibold tabular-nums text-foreground"
                  >
                    {formatDateOnly(subscription.nextBillingDate, activeTenant.locale)}
                  </time>
                  {timing && (
                    <span
                      className={cn(
                        'text-[11px] font-medium',
                        timing.tone === 'overdue'
                          ? 'text-destructive'
                          : timing.tone === 'soon'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      {timing.label}
                    </span>
                  )}
                </div>
              </div>

              {canEdit && (
                <GenerateNextPaymentButton subscriptionId={subscription.id} status={subscription.status} />
              )}
            </div>
          </div>

          {/* Schedule Details (5 cols) */}
          <div className="space-y-3 p-4 text-xs sm:p-5 lg:col-span-5">
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="flex items-center gap-1.5 font-medium text-foreground">
                  {category?.icon && (
                    <span
                      aria-hidden="true"
                      className="inline-flex h-4 w-4 items-center justify-center rounded"
                      style={{
                        backgroundColor: category.backgroundColor || undefined,
                        color: category.textColor || undefined,
                      }}
                    >
                      <CategoryIcon name={category.icon} className="h-3 w-3" />
                    </span>
                  )}
                  <span>{subscription.categoryName}</span>
                </dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Payment method</dt>
                <dd className="font-medium text-foreground">
                  {subscription.paymentMethodName ?? subscription.paymentMethod ?? 'Not specified'}
                </dd>
              </div>

              <div className="flex items-center justify-between gap-3">
                <dt className="text-muted-foreground">Reminder</dt>
                <dd className="font-medium text-foreground">
                  {subscription.reminderLeadDays === 0
                    ? 'Off'
                    : `${subscription.reminderLeadDays} ${subscription.reminderLeadDays === 1 ? 'day' : 'days'} before`}
                </dd>
              </div>

              {subscription.endDate && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">End date</dt>
                  <dd className="font-mono font-medium tabular-nums text-foreground">
                    {formatDateOnly(subscription.endDate, activeTenant.locale)}
                  </dd>
                </div>
              )}
            </dl>

            {subscription.notes && (
              <div className="border-t border-border/60 pt-2.5">
                <span className="block text-[11px] text-muted-foreground">Notes</span>
                <p className="mt-0.5 whitespace-pre-wrap text-xs text-foreground/90">{subscription.notes}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <SubscriptionPaymentsHistory
        subscriptionId={subscription.id}
        headerAction={
          canEdit ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBackfilling(true)}
              className="h-8 gap-1.5 text-xs"
            >
              <History className="h-3.5 w-3.5" />
              Add historical payment
            </Button>
          ) : undefined
        }
      />

      {editing && (
        <SubscriptionFormModal
          subscription={subscription}
          onClose={() => setEditing(false)}
          onSubmit={handleUpdate}
        />
      )}
      {resuming && (
        <ResumeSubscriptionModal
          onClose={() => setResuming(false)}
          onSubmit={(nextBillingDate) =>
            runAction('resumed', () => resume.mutateAsync({ id: subscription.id, nextBillingDate }))
          }
        />
      )}
      {stopping && (
        <StopConfirmation
          subscription={subscription}
          onClose={() => setStopping(false)}
          onConfirm={() => runAction('stopped', () => stop.mutateAsync(subscription.id))}
        />
      )}
      {backfilling && (
        <BackfillPaymentModal subscriptionId={subscription.id} onClose={() => setBackfilling(false)} />
      )}
    </div>
  )
}
