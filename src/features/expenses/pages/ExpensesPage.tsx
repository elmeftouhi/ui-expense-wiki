import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ReceiptText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
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
  const resetFilters = useCallback(() => setFilters(defaultFilters()), [])
  useResetOnTenantChange(resetFilters)
  const expenses = useExpenses(filters)

  const updateFilter = <K extends keyof ExpenseListFilters>(key: K, value: ExpenseListFilters[K] | undefined) => {
    setFilters((current) => ({ ...current, [key]: value, page: 0 }))
  }

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
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <div className="space-y-1 text-xs font-medium text-muted-foreground">
            <span id="expense-category-filter-label">Category</span>
            <CategoryTreeSelect
              label="Category"
              options={categories.options}
              value={filters.categoryId}
              onChange={(id) => updateFilter('categoryId', id)}
              clearLabel="All categories"
              size="sm"
              isLoading={categories.isLoading}
              disabled={!!categories.error}
              className="font-normal text-foreground"
            />
          </div>
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
