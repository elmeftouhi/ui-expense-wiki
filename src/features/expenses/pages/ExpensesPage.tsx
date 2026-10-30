import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Plus, ReceiptText, Search, SlidersHorizontal, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useActiveTenant, useResetOnTenantChange } from '@/features/tenants'
import { useCategoryOptions } from '@/features/budgets/hooks/useCategoryOptions'
import { CategoryTreeSelect } from '@/features/categories/components/CategoryTreeSelect'
import { PaymentMethodSelect } from '@/features/payment-methods/PaymentMethodSelect'
import { getApiErrorMessage } from '@/lib/api-error'
import { ExpenseTable } from '../components/ExpenseTable'
import { useExpenses } from '../hooks/useExpenses'
import type { ExpenseListFilters, ExpenseSortField, ExpenseType, SortDirection } from '../types'

const PAGE_SIZES = [10, 25, 50, 100]

function defaultFilters(): ExpenseListFilters {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1, page: 0, size: 25, sort: 'dueDate', direction: 'desc' }
}

export function ExpensesPage() {
  const { activeTenant, canEdit } = useActiveTenant()
  const categories = useCategoryOptions()
  const [filters, setFilters] = useState<ExpenseListFilters>(defaultFilters)
  const [search, setSearch] = useState('')
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)
  const resetFilters = useCallback(() => {
    setFilters(defaultFilters())
    setSearch('')
    setMoreFiltersOpen(false)
  }, [])
  useResetOnTenantChange(resetFilters)
  const expenses = useExpenses(filters)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextSearch = search.trim() || undefined
      setFilters((current) => current.search === nextSearch ? current : { ...current, search: nextSearch, page: 0 })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [search])

  const updateFilter = <K extends keyof ExpenseListFilters>(key: K, value: ExpenseListFilters[K] | undefined) => {
    setFilters((current) => ({ ...current, [key]: value, page: 0 }))
  }

  const addCategory = (id: number | undefined) => {
    if (id === undefined) return
    const index = categories.options.findIndex((option) => option.id === id)
    if (index === -1) return
    const branch = [id]
    for (let next = index + 1; next < categories.options.length && categories.options[next].depth > categories.options[index].depth; next++) {
      branch.push(categories.options[next].id)
    }
    setFilters((current) => ({ ...current, categoryIds: [...new Set([...(current.categoryIds ?? []), ...branch])], page: 0 }))
  }

  const additionalFilterCount = [filters.year, filters.month, filters.type, filters.status, filters.paymentMethodId, filters.size !== 25].filter(Boolean).length

  const onSort = (sort: ExpenseSortField) => {
    setFilters((current) => ({
      ...current,
      sort,
      direction: current.sort === sort && current.direction === 'asc' ? 'desc' : 'asc',
      page: 0,
    }))
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">Expenses</h1>
            <Badge variant="outline">{activeTenant.name}</Badge>
          </div>
        </div>
        {canEdit && <Button asChild className="gap-2 self-start sm:self-auto"><Link to="/expenses/new"><Plus className="h-4 w-4" />Record expense</Link></Button>}
      </header>

      <nav aria-label="Expense views" className="flex flex-wrap gap-2 border-b border-border pb-3">
        <Link className="rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground" to="/expenses">All expenses</Link>
        <Link className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" to="/expenses/overdue">Overdue</Link>
        <Link className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground" to="/expenses/statistics">Statistics</Link>
      </nav>

      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.6fr)_auto]">
            <label className="space-y-1 text-xs font-medium text-muted-foreground">
              Search
              <div className="relative">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4" />
                <Input type="search" aria-label="Search expenses" placeholder="Search expenses..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9 font-normal text-foreground" />
              </div>
            </label>
            <div className="space-y-1 text-xs font-medium text-muted-foreground">
              <label htmlFor="expense-category-filter">Category</label>
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
            </div>
            <Button type="button" variant="outline" aria-expanded={moreFiltersOpen} aria-controls="expense-more-filters" onClick={() => setMoreFiltersOpen((open) => !open)} className="gap-2">
              <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
              {moreFiltersOpen ? 'Fewer filters' : 'More filters'}
              {additionalFilterCount > 0 && <Badge variant="secondary">{additionalFilterCount}<span className="sr-only">{' active filters'}</span></Badge>}
              <ChevronDown aria-hidden="true" className={`h-4 w-4 ${moreFiltersOpen ? 'rotate-180' : ''}`} />
            </Button>
          </div>
          {!!filters.categoryIds?.length && (
            <div role="group" aria-label="Selected categories" className="flex flex-wrap items-center gap-2">
              {filters.categoryIds.map((id) => {
                const category = categories.options.find((option) => option.id === id)
                const name = category?.name ?? `Category #${id}`
                return (
                  <Badge key={id} variant="secondary" className="gap-1 py-1 pl-2.5 pr-1">
                    <span title={category?.parentName ? `${category.parentName} / ${name}` : name}>{name}</span>
                    <button type="button" aria-label={`Remove ${name}`} onClick={() => updateFilter('categoryIds', filters.categoryIds?.filter((selectedId) => selectedId !== id))} className="rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <X aria-hidden="true" className="h-3.5 w-3.5" />
                    </button>
                  </Badge>
                )
              })}
              <Button type="button" variant="ghost" size="sm" onClick={() => updateFilter('categoryIds', undefined)}>Clear categories</Button>
            </div>
          )}
          <div id="expense-more-filters" hidden={!moreFiltersOpen}>
            <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Year
                <select aria-label="Year" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={filters.year ?? ''} onChange={(event) => {
                  const year = event.target.value ? Number(event.target.value) : undefined
                  setFilters((current) => ({ ...current, year, month: undefined, page: 0 }))
                }}>
                  <option value="">All years</option>
                  {Array.from({ length: 7 }, (_, index) => new Date().getFullYear() - index).map((year) => <option key={year} value={year}>{year}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Month
                <select aria-label="Month" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-50" disabled={!filters.year} value={filters.month ?? ''} onChange={(event) => updateFilter('month', event.target.value ? Number(event.target.value) : undefined)}>
                  <option value="">All months</option>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option key={month} value={month}>{new Intl.DateTimeFormat(activeTenant.locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, month - 1, 1)))}</option>)}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Type
                <select aria-label="Type" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={filters.type ?? ''} onChange={(event) => updateFilter('type', (event.target.value || undefined) as ExpenseType | undefined)}>
                  <option value="">All types</option>
                  <option value="NORMAL">Normal</option>
                  <option value="SUBSCRIPTION">Subscription bill</option>
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Payment status
                <select aria-label="Payment status" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={filters.status ?? ''} onChange={(event) => {
                  const status = event.target.value
                  if (status === '' || status === 'PAID' || status === 'PENDING') {
                    updateFilter('status', status || undefined)
                  }
                }}>
                  <option value="">All statuses</option>
                  <option value="PAID">Paid</option>
                  <option value="PENDING">Pending</option>
                </select>
              </label>
              <div className="space-y-1 text-xs font-medium text-muted-foreground">
                <label htmlFor="expense-method-filter">Payment method</label>
                <PaymentMethodSelect id="expense-method-filter" filter value={filters.paymentMethodId} onChange={(id) => updateFilter('paymentMethodId', id)} />
              </div>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Rows per page
                <select aria-label="Rows per page" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground" value={filters.size} onChange={(event) => updateFilter('size', Number(event.target.value))}>
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      {categories.error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Categories could not be loaded. {getApiErrorMessage(categories.error)}</div>}
      {expenses.isLoading || expenses.isFetching ? (
        <Card><CardContent role="status" aria-live="polite" className="flex items-center gap-3 p-10 text-sm text-muted-foreground"><span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />Loading expenses…</CardContent></Card>
      ) : expenses.error ? (
        <Card><CardContent className="space-y-3 p-8 text-center"><ReceiptText className="mx-auto h-8 w-8 text-muted-foreground" /><p role="alert" className="text-sm text-destructive">{getApiErrorMessage(expenses.error, 'Expenses could not be loaded.')}</p><Button variant="outline" onClick={() => void expenses.refetch()}>Try again</Button></CardContent></Card>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm">
            <p className="text-muted-foreground">{expenses.data?.totalElements ?? 0} expenses</p>
            <p className="text-xs text-muted-foreground">Workspace currency: {activeTenant.currency}</p>
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
          />
        </>
      )}
    </div>
  )
}
