import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useActiveTenant, useResetOnTenantChange } from '@/features/tenants'
import { useCategoryOptions } from '@/features/budgets/hooks/useCategoryOptions'
import { CategoryTreeSelect } from '@/features/categories/components/CategoryTreeSelect'
import { PaymentMethodSelect } from '@/features/payment-methods/PaymentMethodSelect'
import { usePaymentMethods } from '@/features/payment-methods/usePaymentMethods'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatTenantCurrency } from '@/lib/formatters'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { ExpenseTable } from '../components/ExpenseTable'
import { ExpenseViewsNav } from '../components/ExpenseViewsNav'
import { useExpenses } from '../hooks/useExpenses'
import {
  VALID_PAGE_SIZES,
  buildExpenseUrlSearchParams,
  countActiveOptionalFilters,
  defaultExpenseFilters,
  hasNonDefaultFilters,
  isDefaultPeriod,
  parseExpenseSearchParams,
  shiftYearMonth,
} from '../utils/expenseListParams'
import type { ExpenseListFilters, ExpenseSortField, ExpenseStatus, ExpenseType, SortDirection } from '../types'

type QuickStatusOption = '' | Extract<ExpenseStatus, 'PAID' | 'PENDING'>

export function ExpensesPage() {
  const { activeTenant, canEdit } = useActiveTenant()
  const categories = useCategoryOptions()
  const paymentMethods = usePaymentMethods(true)
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const isDesktop = useMediaQuery('(min-width: 768px)', true)
  const isWideHeader = useMediaQuery('(min-width: 1024px)', true)

  const [filters, setFilters] = useState<ExpenseListFilters>(() => parseExpenseSearchParams(searchParams))
  const [search, setSearch] = useState(() => parseExpenseSearchParams(searchParams).search ?? '')
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const [selectedParentIds, setSelectedParentIds] = useState<number[]>([])
  const lastSyncedSearchRef = useRef(searchParams.toString())

  const resetFilters = useCallback(() => {
    const defaults = defaultExpenseFilters()
    setFilters(defaults)
    setSearch('')
    setMoreFiltersOpen(false)
    setSelectedParentIds([])
    lastSyncedSearchRef.current = ''
    setSearchParams(new URLSearchParams(), { replace: true })
  }, [setSearchParams])

  useResetOnTenantChange(resetFilters)

  // Sync external URL changes (e.g., global HeaderSearch or browser Back/Forward) into state
  useEffect(() => {
    const incoming = searchParams.toString()
    if (incoming === lastSyncedSearchRef.current) return
    lastSyncedSearchRef.current = incoming
    const parsed = parseExpenseSearchParams(searchParams)
    setFilters(parsed)
    setSearch(parsed.search ?? '')
  }, [searchParams])

  // Sync internal filter changes out to URL search params
  useEffect(() => {
    const nextParams = buildExpenseUrlSearchParams(filters)
    const nextStr = nextParams.toString()
    if (nextStr === lastSyncedSearchRef.current) return
    lastSyncedSearchRef.current = nextStr
    setSearchParams(nextParams, { replace: true })
  }, [filters, setSearchParams])

  // Lock body scroll when mobile filter bottom sheet is open
  useEffect(() => {
    if (!moreFiltersOpen || isDesktop) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [moreFiltersOpen, isDesktop])

  const expenses = useExpenses(filters)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = search.trim() || undefined
      setFilters((current) => (current.search === nextSearch ? current : { ...current, search: nextSearch, page: 0 }))
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const updateFilter = <K extends keyof ExpenseListFilters>(key: K, value: ExpenseListFilters[K] | undefined) => {
    setFilters((current) => ({ ...current, [key]: value, page: 0 }))
  }

  const addCategory = (id: number | undefined) => {
    if (id === undefined) return
    const index = categories.options.findIndex((option) => option.id === id)
    if (index === -1) {
      setFilters((current) => ({
        ...current,
        categoryIds: [...new Set([...(current.categoryIds ?? []), id])],
        page: 0,
      }))
      return
    }
    const branch = [id]
    for (
      let next = index + 1;
      next < categories.options.length && categories.options[next].depth > categories.options[index].depth;
      next++
    ) {
      branch.push(categories.options[next].id)
    }
    if (branch.length > 1) setSelectedParentIds((current) => [...new Set([...current, id])])
    setFilters((current) => ({
      ...current,
      categoryIds: [...new Set([...(current.categoryIds ?? []), ...branch])],
      page: 0,
    }))
  }

  const additionalFilterCount = countActiveOptionalFilters(filters)
  const nonDefaultActive = hasNonDefaultFilters(filters)

  const onSort = (sort: ExpenseSortField) => {
    setFilters((current) => ({
      ...current,
      sort,
      direction: current.sort === sort && current.direction === 'asc' ? 'desc' : 'asc',
      page: 0,
    }))
  }

  const navigateMonth = (delta: number) => {
    const now = new Date()
    const baseYear = filters.year ?? now.getFullYear()
    const baseMonth = filters.month ?? now.getMonth() + 1
    const next = shiftYearMonth(baseYear, baseMonth, delta)
    setFilters((current) => ({ ...current, year: next.year, month: next.month, page: 0 }))
  }

  const setCurrentMonthPeriod = () => {
    const now = new Date()
    setFilters((current) => ({
      ...current,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      page: 0,
    }))
  }

  const periodLabel = filters.year && filters.month
    ? new Intl.DateTimeFormat(activeTenant.locale, {
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(Date.UTC(filters.year, filters.month - 1, 1)))
    : filters.year
    ? String(filters.year)
    : 'All dates'

  const activePaymentMethodName =
    filters.paymentMethodId !== undefined
      ? paymentMethods.data?.find((m) => m.id === filters.paymentMethodId)?.name ?? `Method #${filters.paymentMethodId}`
      : undefined

  const totalCount = expenses.data?.totalElements ?? 0

  const optionalFilterFields = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="space-y-1 text-xs font-medium text-muted-foreground">
        Year
        <select
          aria-label="Year"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
          value={filters.year ?? ''}
          onChange={(event) => {
            const year = event.target.value ? Number(event.target.value) : undefined
            setFilters((current) => ({ ...current, year, month: undefined, page: 0 }))
          }}
        >
          <option value="">All years</option>
          {Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - index).map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-xs font-medium text-muted-foreground">
        Month
        <select
          aria-label="Month"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground disabled:opacity-50"
          disabled={!filters.year}
          value={filters.month ?? ''}
          onChange={(event) => updateFilter('month', event.target.value ? Number(event.target.value) : undefined)}
        >
          <option value="">All months</option>
          {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
            <option key={month} value={month}>
              {new Intl.DateTimeFormat(activeTenant.locale, { month: 'long', timeZone: 'UTC' }).format(
                new Date(Date.UTC(2024, month - 1, 1)),
              )}
            </option>
          ))}
        </select>
      </label>

      <label className="space-y-1 text-xs font-medium text-muted-foreground">
        Type
        <select
          aria-label="Type"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
          value={filters.type ?? ''}
          onChange={(event) => updateFilter('type', (event.target.value || undefined) as ExpenseType | undefined)}
        >
          <option value="">All types</option>
          <option value="NORMAL">Normal</option>
          <option value="SUBSCRIPTION">Subscription bill</option>
        </select>
      </label>

      <label className="space-y-1 text-xs font-medium text-muted-foreground">
        Payment status
        <select
          aria-label="Payment status"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
          value={filters.status ?? ''}
          onChange={(event) => {
            const status = event.target.value
            if (status === '' || status === 'PAID' || status === 'PENDING') {
              updateFilter('status', status || undefined)
            }
          }}
        >
          <option value="">All statuses</option>
          <option value="PAID">Paid</option>
          <option value="PENDING">Pending</option>
        </select>
      </label>

      <div className="space-y-1 text-xs font-medium text-muted-foreground">
        <label htmlFor="expense-method-filter">Payment method</label>
        <PaymentMethodSelect
          id="expense-method-filter"
          filter
          value={filters.paymentMethodId}
          onChange={(id) => updateFilter('paymentMethodId', id)}
        />
      </div>

      <label className="space-y-1 text-xs font-medium text-muted-foreground">
        Rows per page
        <select
          aria-label="Rows per page"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
          value={filters.size}
          onChange={(event) => updateFilter('size', Number(event.target.value))}
        >
          {VALID_PAGE_SIZES.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </label>
    </div>
  )

  return (
    <div className={cn('space-y-3.5 sm:space-y-4', !isDesktop && canEdit && 'pb-16')}>
      {/* Compact Single-Row Header matching DashboardPage */}
      <header className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
            Expenses
          </h1>
          {isWideHeader && <ExpenseViewsNav active="all" />}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Inline Period Switcher */}
          <div className="inline-flex items-center rounded-lg border border-border/80 bg-card shadow-2xs text-xs">
            <button
              type="button"
              onClick={() => navigateMonth(-1)}
              aria-label="Previous month"
              className="inline-flex h-8 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-l-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span className="inline-flex items-center gap-1.5 border-x border-border/60 px-2.5 py-1 font-medium text-foreground tabular-nums">
              <Calendar className="h-3 w-3 text-muted-foreground hidden sm:inline" aria-hidden="true" />
              {periodLabel}
            </span>
            <button
              type="button"
              onClick={() => navigateMonth(1)}
              aria-label="Next month"
              className="inline-flex h-8 w-7 sm:h-8 sm:w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
            >
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            {filters.year !== undefined ? (
              <button
                type="button"
                onClick={() => setFilters((current) => ({ ...current, year: undefined, month: undefined, page: 0 }))}
                className="border-l border-border/60 px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground rounded-r-lg transition-colors cursor-pointer"
              >
                All dates
              </button>
            ) : (
              <button
                type="button"
                onClick={setCurrentMonthPeriod}
                className="border-l border-border/60 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 rounded-r-lg transition-colors cursor-pointer"
              >
                This month
              </button>
            )}
          </div>

          {canEdit && isDesktop && (
            <Button asChild size="sm" className="h-8 sm:h-9 px-3 gap-1.5 text-xs">
              <Link to="/expenses/new" state={location.search ? { fromExpensesSearch: location.search } : undefined}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Record expense</span>
              </Link>
            </Button>
          )}
        </div>
      </header>

      {/* Sub-navigation on compact viewports (< lg) */}
      {!isWideHeader && (
        <div className="flex items-center justify-between gap-2">
          <ExpenseViewsNav active="all" />
        </div>
      )}

      {/* Compact Filter & Quick-Triage Toolbar */}
      <Card className="border-border/80 shadow-xs">
        <CardContent className="space-y-2.5 p-3 sm:p-3.5">
          <div className="grid items-center gap-2 sm:gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(11rem,0.55fr)_auto_auto]">
            {/* Search Input */}
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label="Search expenses"
                  placeholder="Search expenses..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-9 pl-9 pr-8 text-sm font-normal text-foreground"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Mobile-inline Filters trigger right beside search to save a full vertical row */}
              {!isDesktop && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-expanded={moreFiltersOpen}
                  aria-controls="expense-more-filters"
                  onClick={() => setMoreFiltersOpen((open) => !open)}
                  className="h-9 shrink-0 gap-1.5 px-2.5 text-xs"
                >
                  <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
                  <span>{moreFiltersOpen ? 'Fewer filters' : 'More filters'}</span>
                  {additionalFilterCount > 0 && (
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                      {additionalFilterCount}
                      <span className="sr-only">{' active filters'}</span>
                    </Badge>
                  )}
                </Button>
              )}
            </div>

            {/* Category Selector + Quick Status Pills */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:contents gap-2 items-center">
              <CategoryTreeSelect
                id="expense-category-filter"
                label="Category"
                options={categories.options}
                onChange={addCategory}
                placeholder="Add categories"
                size="sm"
                isLoading={categories.isLoading}
                disabled={!!categories.error}
                className="font-normal text-foreground"
              />

              {/* 1-Tap Quick Status Segmented Filter */}
              <div
                role="group"
                aria-label="Quick status filter"
                className="inline-flex h-9 items-center rounded-lg border border-border/70 bg-muted/50 p-0.5 text-xs shrink-0"
              >
                {(
                  [
                    { value: '', label: 'All' },
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'PAID', label: 'Paid' },
                  ] as Array<{ value: QuickStatusOption; label: string }>
                ).map((option) => {
                  const selected = (filters.status ?? '') === option.value
                  return (
                    <button
                      key={option.label}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => updateFilter('status', option.value || undefined)}
                      className={cn(
                        'h-7 rounded-md px-2.5 font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selected
                          ? 'bg-background text-foreground shadow-2xs font-semibold'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {option.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Desktop More Filters Toggle */}
            {isDesktop && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={moreFiltersOpen}
                aria-controls="expense-more-filters"
                onClick={() => setMoreFiltersOpen((open) => !open)}
                className="h-9 gap-1.5 text-xs"
              >
                <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
                {moreFiltersOpen ? 'Fewer filters' : 'More filters'}
                {additionalFilterCount > 0 && (
                  <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                    {additionalFilterCount}
                    <span className="sr-only">{' active filters'}</span>
                  </Badge>
                )}
                <ChevronDown aria-hidden="true" className={cn('h-3.5 w-3.5 transition-transform', moreFiltersOpen && 'rotate-180')} />
              </Button>
            )}
          </div>

          {/* Active Category & Optional Filter Chips */}
          {(!!filters.categoryIds?.length || filters.type || filters.paymentMethodId !== undefined || !isDefaultPeriod(filters)) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              {!!filters.categoryIds?.length && (
                <div role="group" aria-label="Selected categories" className="flex flex-wrap items-center gap-1.5">
                  {filters.categoryIds
                    .filter((id) => !selectedParentIds.includes(id))
                    .map((id) => {
                      const category = categories.options.find((option) => option.id === id)
                      const name = category?.name ?? `Category #${id}`
                      return (
                        <Badge key={id} variant="secondary" className="gap-1 py-0.5 pl-2 pr-1 text-xs">
                          <span title={category?.parentName ? `${category.parentName} / ${name}` : name}>{name}</span>
                          <button
                            type="button"
                            aria-label={`Remove ${name}`}
                            onClick={() => {
                              const nextIds = filters.categoryIds?.filter((selectedId) => selectedId !== id)
                              updateFilter('categoryIds', nextIds?.length ? nextIds : undefined)
                            }}
                            className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                          >
                            <X aria-hidden="true" className="h-3 w-3" />
                          </button>
                        </Badge>
                      )
                    })}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => {
                      updateFilter('categoryIds', undefined)
                      setSelectedParentIds([])
                    }}
                  >
                    Clear categories
                  </Button>
                </div>
              )}

              {filters.type && (
                <Badge variant="outline" className="gap-1 py-0.5 pl-2 pr-1 text-xs">
                  <span>{filters.type === 'SUBSCRIPTION' ? 'Subscription bill' : 'Normal'}</span>
                  <button
                    type="button"
                    aria-label="Clear type filter"
                    onClick={() => updateFilter('type', undefined)}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  >
                    <X aria-hidden="true" className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              {activePaymentMethodName && (
                <Badge variant="outline" className="gap-1 py-0.5 pl-2 pr-1 text-xs">
                  <span>{activePaymentMethodName}</span>
                  <button
                    type="button"
                    aria-label="Clear payment method filter"
                    onClick={() => updateFilter('paymentMethodId', undefined)}
                    className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  >
                    <X aria-hidden="true" className="h-3 w-3" />
                  </button>
                </Badge>
              )}

              {nonDefaultActive && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="ml-auto h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="h-3 w-3" aria-hidden="true" />
                  <span>Clear all filters</span>
                </Button>
              )}
            </div>
          )}

          {/* Desktop Inline Optional Filters */}
          {isDesktop && moreFiltersOpen && (
            <div id="expense-more-filters" className="border-t border-border/70 pt-3">
              {optionalFilterFields}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile Bottom Sheet for Optional Filters */}
      {!isDesktop && moreFiltersOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 backdrop-blur-xs"
          onClick={(event) => {
            if (event.target === event.currentTarget) setMoreFiltersOpen(false)
          }}
        >
          <section
            id="expense-more-filters"
            role="dialog"
            aria-modal="true"
            aria-label="Filter expenses"
            className="dialog-enter max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-card p-4 pb-6 text-card-foreground shadow-2xl space-y-4"
          >
            <div aria-hidden="true" className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/25" />
            <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
              <h2 className="text-base font-semibold">Filters</h2>
              <div className="flex items-center gap-2">
                {nonDefaultActive && (
                  <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={resetFilters}>
                    Clear all
                  </Button>
                )}
                <button
                  type="button"
                  aria-label="Close filters"
                  onClick={() => setMoreFiltersOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {optionalFilterFields}

            <div className="pt-2">
              <Button type="button" className="w-full" onClick={() => setMoreFiltersOpen(false)}>
                {expenses.isFetching
                  ? 'Updating results…'
                  : `Show ${totalCount} ${totalCount === 1 ? 'expense' : 'expenses'}`}
              </Button>
            </div>
          </section>
        </div>,
        document.body,
      )}

      {categories.error && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          Categories could not be loaded. {getApiErrorMessage(categories.error)}
        </div>
      )}

      {expenses.isLoading || expenses.isFetching ? (
        <Card className="border-border/80 shadow-xs">
          <CardContent role="status" aria-live="polite" className="divide-y divide-border/50 p-0">
            <div className="flex items-center gap-2.5 bg-muted/30 px-4 py-3 text-xs font-medium text-muted-foreground">
              <span aria-hidden="true" className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-r-transparent" />
              <span>Loading expenses…</span>
            </div>
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} aria-hidden="true" className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-8 w-8 rounded-lg bg-muted animate-pulse shrink-0" />
                  <div className="space-y-1.5 flex-1 max-w-xs">
                    <div className="h-3.5 w-3/4 rounded bg-muted animate-pulse" />
                    <div className="h-2.5 w-1/2 rounded bg-muted/70 animate-pulse" />
                  </div>
                </div>
                <div className="h-4 w-20 rounded bg-muted animate-pulse shrink-0" />
              </div>
            ))}
          </CardContent>
        </Card>
      ) : expenses.error ? (
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p role="alert" className="text-sm text-destructive">
              {getApiErrorMessage(expenses.error, 'Expenses could not be loaded.')}
            </p>
            <Button variant="outline" onClick={() => void expenses.refetch()}>Try again</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs sm:text-sm">
            <p className="font-medium text-muted-foreground tabular-nums">
              {totalCount} {totalCount === 1 ? 'expense' : 'expenses'}
            </p>
            <div className="flex flex-wrap items-baseline gap-x-2.5">
              <span className="text-xs font-medium text-muted-foreground">Filtered total</span>
              {expenses.data?.filteredTotalAmount !== undefined ? (
                <span className="font-mono text-base sm:text-lg font-bold tracking-tight text-foreground tabular-nums">
                  {formatTenantCurrency(expenses.data.filteredTotalAmount, activeTenant)}
                </span>
              ) : (
                <span role="alert" className="text-xs text-destructive">
                  Total unavailable: the server did not return a filtered total.
                </span>
              )}
            </div>
          </div>

          <ExpenseTable
            expenses={expenses.data?.content ?? []}
            canEdit={canEdit}
            page={filters.page}
            totalPages={expenses.data?.totalPages ?? 0}
            onPageChange={(page) => setFilters((current) => ({ ...current, page }))}
            sort={filters.sort}
            direction={filters.direction as SortDirection}
            onSort={onSort}
            categories={categories.options}
            onCategoryFilter={addCategory}
            fromSearch={location.search}
            totalElements={expenses.data?.totalElements}
            pageSize={filters.size}
          />
        </>
      )}

      {/* Thumb-Zone Floating Action Button on Small Screens */}
      {canEdit && !isDesktop && (
        <Link
          to="/expenses/new"
          state={location.search ? { fromExpensesSearch: location.search } : undefined}
          aria-label="Record expense"
          className="fixed bottom-5 right-5 z-30 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-[1.02] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span>Record</span>
        </Link>
      )}
    </div>
  )
}
