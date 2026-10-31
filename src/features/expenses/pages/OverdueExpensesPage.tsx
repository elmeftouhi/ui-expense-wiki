import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, CheckCircle2, ClockAlert, Plus, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useCategoryOptions } from '@/features/budgets/hooks/useCategoryOptions'
import { useActiveTenant, useResetOnTenantChange } from '@/features/tenants'
import { getApiErrorMessage } from '@/lib/api-error'
import { formatTenantCurrency } from '@/lib/formatters'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { ExpenseTable } from '../components/ExpenseTable'
import { ExpenseViewsNav } from '../components/ExpenseViewsNav'
import { useOverdueExpenses } from '../hooks/useExpenses'
import type { ExpenseSortField, SortDirection } from '../types'

const PAGE_SIZE = 15

export function OverdueExpensesPage() {
  const { activeTenant, canEdit } = useActiveTenant()
  const categories = useCategoryOptions()
  const overdue = useOverdueExpenses()
  const isWideHeader = useMediaQuery('(min-width: 1024px)', true)

  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<ExpenseSortField>('dueDate')
  const [direction, setDirection] = useState<SortDirection>('asc')

  const resetState = useCallback(() => {
    setPage(0)
    setSearch('')
    setSort('dueDate')
    setDirection('asc')
  }, [])
  useResetOnTenantChange(resetState)

  const filteredAndSorted = useMemo(() => {
    const items = overdue.data ?? []
    const query = search.trim().toLocaleLowerCase()
    const matching = query
      ? items.filter(
          (item) =>
            item.description.toLocaleLowerCase().includes(query) ||
            item.categoryName.toLocaleLowerCase().includes(query) ||
            (item.paymentMethod ?? '').toLocaleLowerCase().includes(query),
        )
      : items

    return [...matching].sort((a, b) => {
      const cmp =
        sort === 'amount'
          ? a.amount - b.amount
          : sort === 'description'
          ? a.description.localeCompare(b.description)
          : sort === 'createdAt'
          ? a.createdAt.localeCompare(b.createdAt)
          : a.dueDate.localeCompare(b.dueDate)
      return direction === 'asc' ? cmp : -cmp
    })
  }, [direction, overdue.data, search, sort])

  const totalAmount = useMemo(
    () => filteredAndSorted.reduce((sum, item) => sum + item.amount, 0),
    [filteredAndSorted],
  )

  const onSort = (nextField: ExpenseSortField) => {
    if (sort === nextField) {
      setDirection((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSort(nextField)
      setDirection(nextField === 'amount' ? 'desc' : 'asc')
    }
    setPage(0)
  }

  return (
    <div className="space-y-3.5 sm:space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
            Overdue expenses
          </h1>
          {isWideHeader && <ExpenseViewsNav active="overdue" overdueCount={overdue.data?.length} />}
        </div>
        {canEdit && (
          <Button asChild size="sm" className="h-8 sm:h-9 px-3 gap-1.5 text-xs">
            <Link to="/expenses/new">
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Record expense</span>
            </Link>
          </Button>
        )}
      </header>

      {!isWideHeader && <ExpenseViewsNav active="overdue" overdueCount={overdue.data?.length} />}

      {overdue.isLoading ? (
        <Card>
          <CardContent role="status" className="flex items-center gap-2.5 p-8 text-sm text-muted-foreground">
            <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-r-transparent" />
            Loading overdue expenses…
          </CardContent>
        </Card>
      ) : overdue.error ? (
        <Card>
          <CardContent className="space-y-3 p-8 text-center">
            <ClockAlert className="mx-auto h-8 w-8 text-muted-foreground" />
            <p role="alert" className="text-sm text-destructive">
              {getApiErrorMessage(overdue.error, 'Overdue expenses could not be loaded.')}
            </p>
            <Button variant="outline" onClick={() => void overdue.refetch()}>Try again</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Overdue Triage Summary Strip */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-3 sm:px-4 shadow-xs">
            <div className="flex items-center justify-between sm:justify-start gap-4">
              <div className="flex items-center gap-2 text-xs sm:text-sm">
                {filteredAndSorted.length > 0 ? (
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                )}
                <span className="font-medium text-foreground">
                  {filteredAndSorted.length === 0
                    ? 'All bills settled'
                    : `${filteredAndSorted.length} overdue ${filteredAndSorted.length === 1 ? 'bill' : 'bills'}`}
                </span>
              </div>
              {filteredAndSorted.length > 0 && (
                <span className="font-mono text-base sm:text-lg font-bold tabular-nums text-destructive">
                  {formatTenantCurrency(totalAmount, activeTenant)}
                </span>
              )}
            </div>

            {(overdue.data?.length ?? 0) > 0 && (
              <div className="relative w-full sm:w-64">
                <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label="Search overdue expenses"
                  placeholder="Filter overdue bills…"
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value)
                    setPage(0)
                  }}
                  className="h-9 pl-9 pr-8 text-xs sm:text-sm"
                />
                {search && (
                  <button
                    type="button"
                    aria-label="Clear overdue search"
                    onClick={() => {
                      setSearch('')
                      setPage(0)
                    }}
                    className="absolute right-2 top-2 rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
          </div>

          <ExpenseTable
            expenses={filteredAndSorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)}
            canEdit={canEdit}
            page={page}
            totalPages={Math.ceil(filteredAndSorted.length / PAGE_SIZE)}
            onPageChange={setPage}
            sort={sort}
            direction={direction}
            onSort={onSort}
            categories={categories.options}
            totalElements={filteredAndSorted.length}
            pageSize={PAGE_SIZE}
            emptyMessage={search ? 'No overdue expenses match your search.' : 'There are no overdue expenses.'}
          />
        </>
      )}
    </div>
  )
}
