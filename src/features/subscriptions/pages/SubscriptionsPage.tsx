import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { formatTenantCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { useCategoryOptions } from '@/features/budgets/hooks/useCategoryOptions'
import type { CategoryOption } from '@/features/budgets/utils/categoryOptions'
import { CategoryIcon } from '@/features/categories/components/CategoryIcon'
import { usePaymentMethods } from '@/features/payment-methods/usePaymentMethods'
import {
  useCreateSubscription,
  useUpdateSubscription,
  useSubscriptions,
  useSubscriptionRecurringCosts,
} from '../hooks/useSubscriptions'
import {
  type SortDirection,
  type Subscription,
  type SubscriptionFilters,
  type SubscriptionSortField,
  type SubscriptionStatus,
} from '../types'
import { SubscriptionFormModal } from '../components/SubscriptionFormModal'
import { SubscriptionStatusBadge } from '../components/SubscriptionStatusBadge'
import { annualCost } from '../utils/recurringCosts'
import { formatDateOnly, formatFrequency, getBillingTiming } from '../utils/subscriptionFormatters'

const PAGE_SIZES = [10, 25, 50, 100]

const STATUS_OPTIONS: { value: SubscriptionStatus; label: string; dotClass: string }[] = [
  { value: 'ACTIVE', label: 'Active', dotClass: 'bg-emerald-500' },
  { value: 'PAUSED', label: 'Paused', dotClass: 'bg-amber-500' },
  { value: 'STOPPED', label: 'Stopped', dotClass: 'bg-muted-foreground' },
  { value: 'ENDED', label: 'Ended', dotClass: 'bg-muted-foreground/50' },
]

const checkboxClass =
  'h-4 w-4 shrink-0 rounded border-input accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'

function CategorySwatch({ category }: { category?: CategoryOption }) {
  const hasCustomBg = Boolean(category?.backgroundColor)
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50',
        !hasCustomBg && 'bg-muted/60 text-muted-foreground',
      )}
      style={{
        backgroundColor: category?.backgroundColor || undefined,
        color: category?.textColor || undefined,
      }}
    >
      <CategoryIcon name={category?.icon} className="h-4 w-4" />
    </span>
  )
}

export function SubscriptionsPage() {
  const { activeTenant } = useActiveTenant()
  return <SubscriptionsPageContent key={activeTenant.id} />
}

function SubscriptionsPageContent() {
  const { activeTenant, canEdit } = useActiveTenant()
  const isDesktop = useMediaQuery('(min-width: 768px)', true)
  const categories = useCategoryOptions()
  const paymentMethods = usePaymentMethods(true)
  const toast = useToast()
  const navigate = useNavigate()
  const create = useCreateSubscription()
  const update = useUpdateSubscription()

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statuses, setStatuses] = useState<SubscriptionStatus[]>([])
  const [paymentMethodIds, setPaymentMethodIds] = useState<number[]>([])
  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<number[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [sort, setSort] = useState<SubscriptionSortField>('nextBillingDate')
  const [direction, setDirection] = useState<SortDirection>('asc')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Subscription | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (!filtersOpen || isDesktop) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [filtersOpen, isDesktop])

  const filters = useMemo<SubscriptionFilters>(
    () => ({
      search: debouncedSearch || undefined,
      status: statuses.length === 1 ? statuses[0] : undefined,
      statuses: statuses.length > 1 ? statuses : undefined,
      categoryIds: categoryIds.length ? categoryIds : undefined,
      paymentMethodId: paymentMethodIds.length === 1 ? paymentMethodIds[0] : undefined,
      paymentMethodIds: paymentMethodIds.length > 1 ? paymentMethodIds[0] !== undefined ? paymentMethodIds : undefined : undefined,
      page,
      size: pageSize,
      sort,
      direction,
    }),
    [debouncedSearch, statuses, categoryIds, paymentMethodIds, page, pageSize, sort, direction],
  )

  const query = useSubscriptions(filters)
  const costs = useSubscriptionRecurringCosts({
    search: filters.search,
    categoryIds: filters.categoryIds,
    status: filters.status,
    statuses: filters.statuses,
    paymentMethodId: filters.paymentMethodId,
    paymentMethodIds: filters.paymentMethodIds,
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

  const toggleStatus = (status: SubscriptionStatus) => {
    resetPage(() => {
      setStatuses((current) =>
        current.includes(status) ? current.filter((item) => item !== status) : [...current, status],
      )
    })
  }

  const selectCategory = (id: number, checked: boolean) => {
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
      setCategoryIds((current) =>
        checked ? [...new Set([...current, ...included])] : current.filter((category) => !included.includes(category)),
      )
    })
  }

  const removeCategory = (id: number) => selectCategory(id, false)

  const categoryRows = useMemo(() => {
    let collapsedDepth: number | undefined
    const rows = []
    for (const [index, category] of categories.options.entries()) {
      if (collapsedDepth !== undefined && category.depth <= collapsedDepth) collapsedDepth = undefined
      const hidden = collapsedDepth !== undefined
      const hasChildren = (categories.options[index + 1]?.depth ?? -1) > category.depth
      const expanded = !collapsedCategoryIds.includes(category.id)
      if (!hidden && hasChildren && !expanded) collapsedDepth = category.depth
      rows.push({ category, hidden, hasChildren, expanded })
    }
    return rows
  }, [categories.options, collapsedCategoryIds])

  const extraFilterCount = (categoryIds.length > 0 ? 1 : 0) + (paymentMethodIds.length > 0 ? 1 : 0)
  const hasFilters = !!search || statuses.length > 0 || categoryIds.length > 0 || paymentMethodIds.length > 0

  const clearFilters = () =>
    resetPage(() => {
      setSearch('')
      setDebouncedSearch('')
      setStatuses([])
      setCategoryIds([])
      setPaymentMethodIds([])
    })

  const changeSort = (field: SubscriptionSortField) => {
    if (sort === field) setDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
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
      toast.success(
        'Subscription created',
        `${created.name} is scheduled for ${formatDateOnly(created.nextBillingDate, activeTenant.locale)}.`,
      )
      navigate(`/subscriptions/${created.id}`)
    } catch (error) {
      toast.error('Could not create subscription', getApiErrorMessage(error))
      throw error
    }
  }

  const pageRange = query.data?.totalElements
    ? `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, query.data.totalElements)} of ${query.data.totalElements}`
    : '0 subscriptions'

  const paymentMethodsById = useMemo(
    () => new Map((paymentMethods.data ?? []).map((method) => [method.id, method])),
    [paymentMethods.data],
  )

  const filterSectionsContent = (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Categories */}
      <fieldset aria-label="Categories" className="min-w-0 space-y-2">
        <span className="block text-xs font-semibold text-foreground">Categories</span>
        {categories.isLoading ? (
          <p role="status" className="text-xs text-muted-foreground">
            Loading categories...
          </p>
        ) : categories.error ? (
          <p role="alert" className="text-xs text-destructive">
            Could not load categories for filtering. {getApiErrorMessage(categories.error)}{' '}
            <button type="button" onClick={() => void categories.refetch()} className="underline">
              Retry categories
            </button>
          </p>
        ) : categories.options.length === 0 ? (
          <p className="text-xs text-muted-foreground">No categories available.</p>
        ) : (
          <div className="custom-scrollbar max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 bg-background p-2">
            {categoryRows.map(({ category, hidden, hasChildren, expanded }) => (
              <div key={category.id} hidden={hidden}>
                <div
                  className="flex items-center gap-1 rounded py-1 pr-1 text-xs hover:bg-muted/40"
                  style={{ paddingLeft: `${category.depth * 12}px` }}
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${category.name}`}
                      aria-expanded={expanded}
                      onClick={() =>
                        setCollapsedCategoryIds((current) =>
                          expanded ? [...current, category.id] : current.filter((id) => id !== category.id),
                        )
                      }
                      className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                    </button>
                  ) : (
                    <span className="w-4 shrink-0" />
                  )}
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={categoryIds.includes(category.id)}
                      onChange={(event) => selectCategory(category.id, event.target.checked)}
                      className={checkboxClass}
                    />
                    <span className="truncate">{category.name}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
      </fieldset>

      {/* Payment Methods */}
      <fieldset aria-label="Payment methods" className="min-w-0 space-y-2">
        <span className="block text-xs font-semibold text-foreground">Payment methods</span>
        {paymentMethods.isPending ? (
          <p role="status" className="text-xs text-muted-foreground">
            Loading payment methods...
          </p>
        ) : paymentMethods.error ? (
          <p role="alert" className="text-xs text-destructive">
            {getApiErrorMessage(paymentMethods.error)}{' '}
            <button type="button" onClick={() => void paymentMethods.refetch()} className="underline">
              Retry payment methods
            </button>
          </p>
        ) : !paymentMethods.data?.length ? (
          <p className="text-xs text-muted-foreground">No payment methods available.</p>
        ) : (
          <div className="custom-scrollbar max-h-52 space-y-0.5 overflow-y-auto rounded-lg border border-border/60 bg-background p-2">
            {paymentMethods.data.map((method) => (
              <label
                key={method.id}
                className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted/40"
              >
                <input
                  type="checkbox"
                  checked={paymentMethodIds.includes(method.id)}
                  onChange={(event) =>
                    resetPage(() =>
                      setPaymentMethodIds((current) =>
                        event.target.checked ? [...current, method.id] : current.filter((id) => id !== method.id),
                      ),
                    )
                  }
                  className={checkboxClass}
                />
                <span className="truncate">
                  {method.name}
                  {!method.active ? ' (inactive)' : method.isDefault ? ' (default)' : ''}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>
    </div>
  )

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Compact Single-Row Header */}
      <header className="flex items-center justify-between gap-3">
        <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Subscriptions
        </h1>
        {canEdit && (
          <Button size="sm" onClick={() => setFormOpen(true)} className="h-8 shrink-0 gap-1.5 text-xs sm:h-9">
            <Plus className="h-3.5 w-3.5" />
            New subscription
          </Button>
        )}
      </header>

      {/* Unified Recurring Costs Strip */}
      <section aria-label="Recurring subscription costs" className="space-y-2">
        <div className="overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs">
          <dl className="grid grid-cols-2 divide-x divide-border/60">
            {(['monthly', 'yearly'] as const).map((period) => (
              <div key={period} className="min-w-0 p-3.5 sm:px-5 sm:py-4">
                <dt className="text-xs font-medium text-muted-foreground">
                  {period === 'monthly' ? 'Monthly equivalent' : 'Yearly equivalent'}
                </dt>
                <dd className="mt-1 font-mono text-xl font-bold tabular-nums tracking-tight text-foreground sm:text-2xl">
                  {costs.isLoading || costs.isError ? '—' : money(recurringCosts[period])}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        {costs.isError && (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-xs text-destructive">
            <p>Could not load recurring costs. {getApiErrorMessage(costs.error)}</p>
            <Button variant="outline" size="sm" onClick={() => void costs.refetch()} className="h-7 text-xs">
              Retry recurring costs
            </Button>
          </div>
        )}
      </section>

      {/* Compact Toolbar: Status Pills + Search + Filters Trigger */}
      <div aria-label="Subscription filters" role="region" className="space-y-2.5">
        <div className="flex flex-col items-stretch justify-between gap-2.5 lg:flex-row lg:items-center">
          {/* Quick Status Multi-Toggle Pills */}
          <div
            role="group"
            aria-label="Status"
            className="no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-lg border border-border/60 bg-muted/50 p-1 text-xs"
          >
            <button
              type="button"
              aria-pressed={statuses.length === 0}
              onClick={() => resetPage(() => setStatuses([]))}
              className={cn(
                'cursor-pointer whitespace-nowrap rounded-md px-2.5 py-1.5 font-medium transition-colors',
                statuses.length === 0
                  ? 'bg-background font-semibold text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              All
            </button>
            {STATUS_OPTIONS.map(({ value, label, dotClass }) => {
              const selected = statuses.includes(value)
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleStatus(value)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 font-medium transition-colors',
                    selected
                      ? 'bg-background font-semibold text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />
                  <span>{label}</span>
                </button>
              )
            })}
          </div>

          {/* Search + Filters Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 lg:w-64 lg:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(event) => resetPage(() => setSearch(event.target.value))}
                placeholder="Search subscriptions…"
                aria-label="Search subscriptions"
                className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-ring [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => resetPage(() => { setSearch(''); setDebouncedSearch('') })}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              type="button"
              variant={filtersOpen || extraFilterCount > 0 ? 'secondary' : 'outline'}
              size="sm"
              aria-expanded={filtersOpen}
              onClick={() => setFiltersOpen((prev) => !prev)}
              className="h-9 shrink-0 gap-1.5 text-xs"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>Filters</span>
              {extraFilterCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] font-semibold text-primary-foreground">
                  {extraFilterCount}
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* Desktop Collapsible Filter Panel */}
        {isDesktop && filtersOpen && (
          <div className="rounded-xl border border-border/80 bg-card p-4 shadow-xs">
            {filterSectionsContent}
          </div>
        )}

        {/* Mobile Bottom-Sheet Filter Drawer */}
        {!isDesktop &&
          filtersOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) setFiltersOpen(false)
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Filter subscriptions"
                className="dialog-enter custom-scrollbar max-h-[85vh] w-full space-y-4 overflow-y-auto rounded-t-2xl border border-border bg-card p-5 pb-6 shadow-2xl"
              >
                <div aria-hidden="true" className="mx-auto mb-1 h-1 w-10 rounded-full bg-muted-foreground/25" />
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <h2 className="text-sm font-semibold text-foreground">Filters</h2>
                  <button
                    type="button"
                    aria-label="Close filters"
                    onClick={() => setFiltersOpen(false)}
                    className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {filterSectionsContent}
                <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={!hasFilters}
                    onClick={clearFilters}
                    className="h-9 text-xs"
                  >
                    Clear all
                  </Button>
                  <Button type="button" size="sm" onClick={() => setFiltersOpen(false)} className="h-9 text-xs">
                    Done
                  </Button>
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* Active Filter Chips Row */}
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            {statuses.map((status) => {
              const label = STATUS_OPTIONS.find((item) => item.value === status)?.label ?? status
              return (
                <Badge key={status} variant="secondary" className="gap-1 py-0.5 pl-2 pr-1 text-[11px] font-medium">
                  {label}
                  <button
                    type="button"
                    aria-label={`Remove ${label} status filter`}
                    onClick={() => toggleStatus(status)}
                    className="cursor-pointer rounded p-0.5 hover:bg-muted"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </Badge>
              )
            })}

            {categoryIds.length > 0 && (
              <ul aria-label="Selected category filters" className="flex flex-wrap gap-1.5">
                {categoryIds.map((id) => {
                  const name = categories.byId.get(id)?.name ?? `Category #${id}`
                  return (
                    <li key={id}>
                      <Badge variant="secondary" className="gap-1 py-0.5 pl-2 pr-1 text-[11px] font-medium">
                        {name}
                        <button
                          type="button"
                          aria-label={`Remove ${name} category filter`}
                          onClick={() => removeCategory(id)}
                          className="cursor-pointer rounded p-0.5 hover:bg-muted"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            )}

            {paymentMethodIds.map((id) => {
              const name = paymentMethodsById.get(id)?.name ?? `Method #${id}`
              return (
                <Badge key={id} variant="secondary" className="gap-1 py-0.5 pl-2 pr-1 text-[11px] font-medium">
                  {name}
                  <button
                    type="button"
                    aria-label={`Remove ${name} payment method filter`}
                    onClick={() =>
                      resetPage(() => setPaymentMethodIds((current) => current.filter((item) => item !== id)))
                    }
                    className="cursor-pointer rounded p-0.5 hover:bg-muted"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </Badge>
              )
            })}

            <button
              type="button"
              onClick={clearFilters}
              className="ml-1 cursor-pointer rounded text-xs font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring"
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Subscriptions Ledger Card */}
      <Card className="min-w-0 overflow-hidden border-border/80 shadow-xs">
        {query.isLoading ? (
          <div role="status" aria-busy="true" className="space-y-2.5 p-4 sm:p-5">
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : query.isError ? (
          <div role="alert" className="flex flex-col items-center gap-3 p-12 text-center">
            <ShieldAlert className="h-7 w-7 text-destructive" />
            <div>
              <p className="text-sm font-semibold text-foreground">Could not load subscriptions</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{getApiErrorMessage(query.error)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()} className="text-xs">
              Retry
            </Button>
          </div>
        ) : subscriptions.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                {hasFilters ? 'No subscriptions match these filters' : 'No subscriptions yet'}
              </h2>
              {!hasFilters && (
                <p className="mx-auto mt-0.5 max-w-xs text-xs text-muted-foreground">
                  Track recurring commitments and generate bills on their due dates.
                </p>
              )}
            </div>
            {hasFilters ? (
              <Button variant="outline" size="sm" onClick={clearFilters} className="text-xs">
                Reset filters
              </Button>
            ) : (
              canEdit && (
                <Button onClick={() => setFormOpen(true)} size="sm" className="gap-1.5 text-xs">
                  <Plus className="h-3.5 w-3.5" /> Create subscription
                </Button>
              )
            )}
          </div>
        ) : isDesktop ? (
          <div className="custom-scrollbar overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/30 text-[11px] font-medium text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => changeSort('name')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                    >
                      <span>Name</span>
                      {sort === 'name' &&
                        (direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => changeSort('nextBillingDate')}
                      className="inline-flex cursor-pointer items-center gap-1 hover:text-foreground"
                    >
                      <span>Next billing</span>
                      {sort === 'nextBillingDate' &&
                        (direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
                    </button>
                  </th>
                  <th scope="col" className="px-4 py-2.5">Payment method</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Amount</th>
                  <th scope="col" className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {subscriptions.map((subscription) => {
                  const timing = getBillingTiming(subscription)
                  const category = categories.byId.get(subscription.categoryId)
                  const methodLabel =
                    subscription.paymentMethodName ?? subscription.paymentMethod ?? 'Not specified'
                  const editable = canEdit && ['ACTIVE', 'PAUSED'].includes(subscription.status)
                  const dimmed = subscription.status === 'STOPPED' || subscription.status === 'ENDED'

                  return (
                    <tr
                      key={subscription.id}
                      onClick={(event) => {
                        if ((event.target as HTMLElement).closest('a, button')) return
                        navigate(`/subscriptions/${subscription.id}`)
                      }}
                      className={cn(
                        'cursor-pointer transition-colors hover:bg-muted/25',
                        dimmed && 'opacity-65',
                      )}
                    >
                      <td className="max-w-72 px-4 py-3">
                        <div className="flex items-center gap-3">
                          <CategorySwatch category={category} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/subscriptions/${subscription.id}`}
                                className="truncate font-semibold text-foreground hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                              >
                                {subscription.name}
                              </Link>
                              {subscription.status !== 'ACTIVE' && (
                                <SubscriptionStatusBadge status={subscription.status} />
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                              {subscription.categoryName} ·{' '}
                              {formatFrequency(subscription.frequency, subscription.customIntervalDays)}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <time
                          dateTime={subscription.nextBillingDate}
                          className="font-mono font-medium tabular-nums text-foreground"
                        >
                          {formatDateOnly(subscription.nextBillingDate, activeTenant.locale)}
                        </time>
                        {timing && (
                          <p
                            className={cn(
                              'mt-0.5 text-[11px] font-medium',
                              timing.tone === 'overdue'
                                ? 'text-destructive'
                                : timing.tone === 'soon'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-muted-foreground',
                            )}
                          >
                            {timing.label}
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3 text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5 text-foreground/85">
                          <CreditCard className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span>{methodLabel}</span>
                        </span>
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono tabular-nums">
                        <p className="font-semibold text-foreground">{money(subscription.amount)}</p>
                        {subscription.frequency !== 'MONTHLY' && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {money(annualCost(subscription) / 12)} / month
                          </p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button asChild size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                            <Link
                              to={`/subscriptions/${subscription.id}`}
                              aria-label={`View ${subscription.name}`}
                              title="View subscription"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                          {editable && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation()
                                setEditing(subscription)
                              }}
                              aria-label={`Edit ${subscription.name}`}
                              title="Edit subscription"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Mobile Stacked Subscription Cards (< 768px) */
          <ul className="divide-y divide-border/60">
            {subscriptions.map((subscription) => {
              const timing = getBillingTiming(subscription)
              const category = categories.byId.get(subscription.categoryId)
              const methodLabel = subscription.paymentMethodName ?? subscription.paymentMethod
              const editable = canEdit && ['ACTIVE', 'PAUSED'].includes(subscription.status)
              const dimmed = subscription.status === 'STOPPED' || subscription.status === 'ENDED'

              return (
                <li
                  key={subscription.id}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('a, button')) return
                    navigate(`/subscriptions/${subscription.id}`)
                  }}
                  className={cn(
                    'flex cursor-pointer items-start justify-between gap-3 p-4 transition-colors active:bg-muted/40',
                    dimmed && 'opacity-65',
                  )}
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <CategorySwatch category={category} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Link
                          to={`/subscriptions/${subscription.id}`}
                          className="truncate text-sm font-semibold text-foreground"
                        >
                          {subscription.name}
                        </Link>
                        {subscription.status !== 'ACTIVE' && (
                          <SubscriptionStatusBadge status={subscription.status} />
                        )}
                      </div>

                      <p className="truncate text-[11px] text-muted-foreground">
                        {subscription.categoryName} ·{' '}
                        {formatFrequency(subscription.frequency, subscription.customIntervalDays)}
                        {methodLabel && ` · ${methodLabel}`}
                      </p>

                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <time
                          dateTime={subscription.nextBillingDate}
                          className="font-mono tabular-nums text-muted-foreground"
                        >
                          {formatDateOnly(subscription.nextBillingDate, activeTenant.locale)}
                        </time>
                        {timing && (
                          <span
                            className={cn(
                              'font-medium',
                              timing.tone === 'overdue'
                                ? 'text-destructive'
                                : timing.tone === 'soon'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-muted-foreground',
                            )}
                          >
                            · {timing.label}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-start gap-1.5 text-right">
                    <div>
                      <p className="font-mono text-sm font-bold tabular-nums text-foreground">
                        {money(subscription.amount)}
                      </p>
                      {subscription.frequency !== 'MONTHLY' && (
                        <p className="font-mono text-[10px] tabular-nums text-muted-foreground">
                          {money(annualCost(subscription) / 12)} / month
                        </p>
                      )}
                    </div>
                    {editable && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={(event) => {
                          event.stopPropagation()
                          setEditing(subscription)
                        }}
                        aria-label={`Edit ${subscription.name}`}
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        {!query.isLoading && !query.isError && (
          <footer className="flex flex-wrap items-center justify-between gap-2.5 border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums">{pageRange}</span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5">
                <span className="hidden sm:inline">Rows per page</span>
                <select
                  aria-label="Rows per page"
                  value={pageSize}
                  onChange={(event) => resetPage(() => setPageSize(Number(event.target.value)))}
                  className="h-8 rounded-lg border border-input bg-background px-2 font-mono text-xs text-foreground"
                >
                  {PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => Math.max(0, current - 1))}
                disabled={page <= 0 || query.isFetching}
                aria-label="Previous page"
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="font-mono tabular-nums">
                Page {totalPages === 0 ? 0 : page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((current) => current + 1)}
                disabled={page + 1 >= totalPages || query.isFetching}
                aria-label="Next page"
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void query.refetch()
                  void costs.refetch()
                }}
                disabled={query.isFetching || costs.isFetching}
                aria-label="Refresh subscriptions"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw
                  className={cn('h-3.5 w-3.5', (query.isFetching || costs.isFetching) && 'animate-spin')}
                />
              </Button>
            </div>
          </footer>
        )}
      </Card>

      {formOpen && <SubscriptionFormModal onClose={() => setFormOpen(false)} onSubmit={handleCreate} />}
      {editing && (
        <SubscriptionFormModal subscription={editing} onClose={() => setEditing(null)} onSubmit={handleUpdate} />
      )}
    </div>
  )
}
