import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowUpRight, CalendarClock, ChevronDown, ChevronLeft, ChevronRight, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { formatTenantCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { useCategoryOptions } from '@/features/budgets/hooks/useCategoryOptions'
import { CategoryTreeSelect } from '@/features/categories/components/CategoryTreeSelect'
import { PaymentMethodSelect } from '@/features/payment-methods/PaymentMethodSelect'
import {
  useCreateSubscription,
  useUpdateSubscription,
  useSubscriptions,
  useSubscriptionRecurringCosts,
} from '../hooks/useSubscriptions'
import { type SortDirection, type Subscription, type SubscriptionFilters, type SubscriptionSortField, type SubscriptionStatus } from '../types'
import { SubscriptionFormModal } from '../components/SubscriptionFormModal'
import { annualCost } from '../utils/recurringCosts'

const PAGE_SIZES = [10, 25, 50, 100]

function formatDateOnly(date: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return '—'
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
    new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
}

function billingTiming(subscription: Subscription) {
  if (subscription.status !== 'ACTIVE') return null
  const { overdue, daysLeftBeforeDueDate: days } = subscription
  if (overdue) return { overdue, days, label: 'Overdue' }
  if (days === null) return null
  return {
    overdue,
    days,
    label: days === 0 ? 'Due today' : `${days} ${days === 1 ? 'day' : 'days'} left`,
  }
}

function StatusFilter({ value, onChange }: { value: SubscriptionStatus | ''; onChange: (value: SubscriptionStatus | '') => void }) {
  return (
    <select aria-label="Filter by status" value={value} onChange={(event) => onChange(event.target.value as SubscriptionStatus | '')} className="h-9 rounded-lg border border-input bg-background px-2 text-xs">
      <option value="">All statuses</option>
      <option value="ACTIVE">Active</option>
      <option value="PAUSED">Paused</option>
      <option value="STOPPED">Stopped</option>
      <option value="ENDED">Ended</option>
    </select>
  )
}

export function SubscriptionsPage() {
  const { activeTenant } = useActiveTenant()
  return <SubscriptionsPageContent key={activeTenant.id} />
}

function SubscriptionsPageContent() {
  const { activeTenant, canEdit } = useActiveTenant()
  const categories = useCategoryOptions()
  const toast = useToast()
  const navigate = useNavigate()
  const create = useCreateSubscription()
  const update = useUpdateSubscription()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState<SubscriptionStatus | ''>('')
  const [categoryId, setCategoryId] = useState<number | undefined>()
  const [paymentMethodId, setPaymentMethodId] = useState<number | undefined>()
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [sort, setSort] = useState<SubscriptionSortField>('nextBillingDate')
  const [direction, setDirection] = useState<SortDirection>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const filters = useMemo<SubscriptionFilters>(() => ({
    search: debouncedSearch || undefined,
    status: status || undefined,
    categoryIds: categoryIds.length ? categoryIds : undefined,
    paymentMethodId,
    page,
    size: pageSize,
    sort,
    direction,
  }), [debouncedSearch, status, categoryIds, paymentMethodId, page, pageSize, sort, direction])
  const query = useSubscriptions(filters)
  const costs = useSubscriptionRecurringCosts({
    search: filters.search,
    categoryIds: filters.categoryIds,
    status: filters.status,
    paymentMethodId: filters.paymentMethodId,
  })
  const subscriptions = query.data?.content ?? []
  const totalPages = query.data?.totalPages ?? 0
  const money = (amount: number) => formatTenantCurrency(amount, activeTenant)
  const recurringCosts = (costs.data ?? []).reduce(
    (total, cost) => ({ monthly: total.monthly + cost.monthly, yearly: total.yearly + cost.yearly }),
    { monthly: 0, yearly: 0 },
  )

  const resetPage = (action: () => void) => {
    action()
    setPage(0)
  }

  const selectCategory = (id: number | undefined) => {
    const index = categories.options.findIndex((option) => option.id === id)
    const selected = categories.options[index]
    const included = selected ? [selected.id] : []
    if (selected) {
      for (let next = index + 1; next < categories.options.length; next += 1) {
        const option = categories.options[next]
        if (option.depth <= selected.depth) break
        included.push(option.id)
      }
    }
    resetPage(() => {
      setCategoryId(id)
      setCategoryIds(included)
    })
  }

  const removeCategory = (id: number) => resetPage(() => {
    setCategoryIds((current) => current.filter((category) => category !== id))
    if (categoryId === id) setCategoryId(undefined)
  })

  const changeSort = (field: SubscriptionSortField) => {
    if (sort === field) setDirection((current) => current === 'asc' ? 'desc' : 'asc')
    else {
      setSort(field)
      setDirection('asc')
    }
    setPage(0)
  }

  const handleUpdate = async (payload: Parameters<typeof update.mutateAsync>[0]['payload']) => {
    if (!editing) throw new Error('Select a subscription to update.')
    try {
      await update.mutateAsync({ id: editing.id, payload })
      toast.success('Subscription updated', 'Changes apply to future payments.')
    } catch (error) {
      toast.error('Could not update subscription', getApiErrorMessage(error))
      throw error
    }
  }

  const handleCreate = async (payload: Parameters<typeof create.mutateAsync>[0]) => {
    try {
      const created = await create.mutateAsync(payload)
      toast.success('Subscription created', `${created.name} is scheduled for ${formatDateOnly(created.nextBillingDate, activeTenant.locale)}.`)
      navigate(`/subscriptions/${created.id}`)
    } catch (error) {
      toast.error('Could not create subscription', getApiErrorMessage(error))
      throw error
    }
  }

  const pageRange = query.data?.totalElements
    ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, query.data.totalElements)} of ${query.data.totalElements}`
    : '0 subscriptions'

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 border-b border-border/40 pb-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <CalendarClock className="h-6 w-6 text-primary" /> Subscriptions
            <Badge variant="outline" className="text-xs font-medium">{activeTenant.name}</Badge>
          </h1>
        </div>
        {canEdit && <Button onClick={() => setFormOpen(true)} className="gap-2"><Plus className="h-4 w-4" /> New subscription</Button>}
      </header>

      <section aria-label="Recurring subscription costs">
        <dl className="grid gap-4 sm:grid-cols-2">
          {(['monthly', 'yearly'] as const).map((period) => (
            <Card key={period} className="min-w-0 px-5 py-4">
              <dt className="text-xs text-muted-foreground">{period === 'monthly' ? 'Monthly equivalent' : 'Yearly equivalent'}</dt>
              <dd className="mt-1 space-y-1 text-2xl font-semibold tabular-nums">
                {costs.isLoading || costs.isError ? '—' : (
                  <p className="break-words">{money(recurringCosts[period])} <span className="text-xs font-normal text-muted-foreground">{activeTenant.currency}</span></p>
                )}
              </dd>
            </Card>
          ))}
        </dl>
        {costs.isError && (
          <div role="alert" className="mt-3 flex flex-wrap items-center gap-2 text-xs text-destructive">
            <p>Could not load recurring costs. {getApiErrorMessage(costs.error)}</p>
            <Button variant="outline" size="sm" onClick={() => void costs.refetch()}>Retry recurring costs</Button>
          </div>
        )}
      </section>

      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(180px,240px)_160px_minmax(160px,1fr)]">
          <label className="relative sm:col-span-2 lg:col-span-1">
            <span className="sr-only">Search subscriptions</span>
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input type="search" value={search} onChange={(event) => resetPage(() => setSearch(event.target.value))} placeholder="Search subscriptions..." className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs" />
          </label>
          <CategoryTreeSelect
            label="Filter by category"
            options={categories.options}
            value={categoryId}
            onChange={selectCategory}
            clearLabel={categoryIds.length ? 'Clear category filters' : 'All categories'}
            size="sm"
            isLoading={categories.isLoading}
          />
          <StatusFilter value={status} onChange={(value) => resetPage(() => setStatus(value))} />
          <PaymentMethodSelect id="subscription-method-filter" filter value={paymentMethodId} onChange={(id) => resetPage(() => setPaymentMethodId(id))} />
          {categoryIds.length > 0 && (
            <ul aria-label="Selected category filters" className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
              {categoryIds.map((id) => {
                const name = categories.byId.get(id)?.name ?? `Category #${id}`
                return (
                  <li key={id}>
                    <Badge variant="secondary" className="gap-1 py-1 pl-2 pr-1">
                      {name}
                      <button type="button" aria-label={`Remove ${name} category filter`} onClick={() => removeCategory(id)} className="rounded p-1 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring">
                        <X className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </Badge>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {categories.error && <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-xs text-destructive">Could not load categories for filtering. {getApiErrorMessage(categories.error)}</p>}

      <Card className="overflow-hidden">
        {query.isLoading ? (
          <div role="status" aria-busy="true" className="space-y-3 p-6">
            {Array.from({ length: 5 }, (_, index) => <div key={index} className="h-10 animate-pulse rounded bg-muted" />)}
          </div>
        ) : query.isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 p-12 text-center">
            <p className="text-sm font-semibold">Could not load subscriptions</p>
            <p className="text-xs text-muted-foreground">{getApiErrorMessage(query.error)}</p>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <CalendarClock className="h-8 w-8 text-muted-foreground" />
            <div><h2 className="text-sm font-semibold">{filters.search || status || categoryIds.length > 0 || paymentMethodId ? 'No subscriptions match these filters' : 'No subscriptions yet'}</h2>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">Create a subscription to schedule recurring payments. Linked expenses appear separately in Expenses.</p></div>
            {canEdit && <Button onClick={() => setFormOpen(true)} size="sm"><Plus className="mr-1.5 h-4 w-4" /> Create subscription</Button>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead className="bg-muted/40 text-xs font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-3"><button type="button" onClick={() => changeSort('name')} className="flex items-center gap-1">Name <ChevronDown className={cn('h-3 w-3', sort === 'name' && direction === 'desc' && 'rotate-180')} /></button></th>
                  <th className="px-4 py-3"><button type="button" onClick={() => changeSort('nextBillingDate')} className="flex items-center gap-1">Next billing <ChevronDown className={cn('h-3 w-3', sort === 'nextBillingDate' && direction === 'desc' && 'rotate-180')} /></button></th>
                  <th className="px-4 py-3">Payment method</th>
                  <th className="px-4 py-3 text-right bg-muted/30">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {subscriptions.map((subscription) => {
                  const timing = billingTiming(subscription)
                  return (
                    <tr key={subscription.id} className="hover:bg-muted/30">
                      <td className="max-w-56 px-4 py-3">
                        <Link to={`/subscriptions/${subscription.id}`} className="font-semibold text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring">{subscription.name}</Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <time dateTime={subscription.nextBillingDate}>{formatDateOnly(subscription.nextBillingDate, activeTenant.locale)}</time>
                        {timing && <p className={cn('mt-1 text-[11px] font-medium', timing.overdue ? 'text-destructive' : timing.days !== null && timing.days <= 7 ? 'text-primary' : 'text-muted-foreground')}>{timing.label}</p>}
                      </td>
                      <td className="px-4 py-3">{subscription.paymentMethodName ?? subscription.paymentMethod ?? 'Not specified'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                        <p className="font-bold">{money(subscription.amount)}</p>
                        {subscription.frequency !== 'MONTHLY' && (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {money(annualCost(subscription) / 12)} / month
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button asChild size="icon" variant="ghost"><Link to={`/subscriptions/${subscription.id}`} aria-label={`View ${subscription.name}`} title="View subscription"><ArrowUpRight className="h-4 w-4" /></Link></Button>
                          {canEdit && ['ACTIVE', 'PAUSED'].includes(subscription.status) && <Button size="icon" variant="outline" onClick={() => setEditing(subscription)} aria-label={`Edit ${subscription.name}`} title="Edit subscription"><Pencil className="h-4 w-4" /></Button>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        {!query.isLoading && !query.isError && (
          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
            <span>{pageRange}</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2">
                Rows per page
                <select
                  value={pageSize}
                  onChange={(event) => resetPage(() => setPageSize(Number(event.target.value)))}
                  className="h-9 rounded-lg border border-input bg-background px-2 text-xs text-foreground"
                >
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page <= 0 || query.isFetching} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
              <span>Page {totalPages === 0 ? 0 : page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage((current) => current + 1)} disabled={page + 1 >= totalPages || query.isFetching} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => { void query.refetch(); void costs.refetch() }} disabled={query.isFetching || costs.isFetching} aria-label="Refresh subscriptions"><RefreshCw className={cn('h-4 w-4', (query.isFetching || costs.isFetching) && 'animate-spin')} /></Button>
            </div>
          </footer>
        )}
      </Card>

      {formOpen && <SubscriptionFormModal onClose={() => setFormOpen(false)} onSubmit={handleCreate} />}
      {editing && <SubscriptionFormModal subscription={editing} onClose={() => setEditing(null)} onSubmit={handleUpdate} />}
    </div>
  )
}
