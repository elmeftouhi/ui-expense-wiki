import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useActiveTenant } from '@/features/tenants'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { ExpenseActions } from './ExpenseActions'
import { ExpenseStatusBadge } from './ExpenseStatusBadge'
import { SubscriptionOriginBadge } from './SubscriptionOriginBadge'
import type { ExpenseResponse, ExpenseSortField, SortDirection } from '../types'

const SORT_LABELS: Record<ExpenseSortField, string> = {
  dueDate: 'Due date',
  description: 'Description',
  amount: 'Amount',
  createdAt: 'Date added',
}

export function ExpenseTable({
  expenses,
  canEdit,
  page,
  totalPages,
  onPageChange,
  sort,
  direction,
  onSort,
  emptyMessage = 'No expenses match these filters.',
}: {
  expenses: ExpenseResponse[]
  canEdit: boolean
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  sort?: ExpenseSortField
  direction?: SortDirection
  onSort?: (field: ExpenseSortField) => void
  emptyMessage?: string
}) {
  const { activeTenant } = useActiveTenant()
  // Falls back to the table when matchMedia is unavailable (tests, SSR).
  const isDesktop = useMediaQuery('(min-width: 768px)', true)
  const money = (expense: ExpenseResponse) => formatCurrency(expense.amount, { currency: expense.currency, locale: activeTenant.locale })
  const date = (value?: string | null) => formatDate(value, { locale: activeTenant.locale, timeZone: 'UTC' })
  const DirectionIcon = direction === 'asc' ? ArrowUp : ArrowDown

  const sortable = (field: ExpenseSortField, label: string, alignRight = false) => (
    <button
      type="button"
      onClick={() => onSort?.(field)}
      disabled={!onSort}
      className={cn(
        'inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:text-inherit',
        alignRight && 'flex-row-reverse',
      )}
    >
      {label}
      {sort === field && <DirectionIcon className="h-3 w-3" aria-label={direction === 'asc' ? 'ascending' : 'descending'} />}
    </button>
  )

  const empty = (
    <div className="px-4 py-14 text-center">
      <p className="font-medium">{emptyMessage}</p>
      <p className="mt-1 text-sm text-muted-foreground">Try changing the filters or record an expense.</p>
      {canEdit && <Button asChild size="sm" className="mt-4"><Link to="/expenses/new">Record expense</Link></Button>}
    </div>
  )

  return (
    <Card>
      <CardContent className="p-0">
        {isDesktop ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">{sortable('description', 'Expense')}</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">{sortable('amount', 'Amount', true)}</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">{sortable('dueDate', 'Due date')}</th>
                  <th scope="col" className="w-px px-2 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/70">
                {expenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <Link to={`/expenses/${expense.id}`} className="font-medium text-foreground underline-offset-4 hover:underline">{expense.description}</Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <Link to="/categories" className="hover:text-foreground hover:underline">{expense.categoryName}</Link>
                        <SubscriptionOriginBadge expense={expense} />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium tabular-nums">{money(expense)}</td>
                    <td className="px-4 py-2.5"><ExpenseStatusBadge status={expense.status} /></td>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                      <span className="text-muted-foreground">{date(expense.dueDate)}</span>
                      {expense.paidDate && <span className="block text-xs text-muted-foreground">Paid {date(expense.paidDate)}</span>}
                    </td>
                    <td className="px-2 py-2.5"><ExpenseActions expense={expense} canEdit={canEdit} variant="compact" /></td>
                  </tr>
                ))}
                {expenses.length === 0 && <tr><td colSpan={5}>{empty}</td></tr>}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {onSort && (
              <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs text-muted-foreground">
                <label htmlFor="expense-mobile-sort">Sort by</label>
                <select
                  id="expense-mobile-sort"
                  value={sort ?? ''}
                  onChange={(event) => onSort(event.target.value as ExpenseSortField)}
                  className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                >
                  {!sort && <option value="">Default</option>}
                  {(Object.keys(SORT_LABELS) as ExpenseSortField[]).map((field) => <option key={field} value={field}>{SORT_LABELS[field]}</option>)}
                </select>
                {sort && (
                  <button
                    type="button"
                    onClick={() => onSort(sort)}
                    aria-label={direction === 'asc' ? 'Sort descending' : 'Sort ascending'}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <DirectionIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}
            {expenses.length === 0 ? empty : (
              <ul className="divide-y divide-border/70" aria-label="Expense list">
                {expenses.map((expense) => (
                  <li key={expense.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 px-3 py-3">
                    <Link to={`/expenses/${expense.id}`} className="truncate font-medium text-foreground underline-offset-4 hover:underline">{expense.description}</Link>
                    <span className="text-right font-medium tabular-nums">{money(expense)}</span>
                    <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Link to="/categories" className="truncate hover:text-foreground hover:underline">{expense.categoryName}</Link>
                      <SubscriptionOriginBadge expense={expense} />
                    </div>
                    <div className="justify-self-end"><ExpenseStatusBadge status={expense.status} /></div>
                    <div className="self-center text-xs tabular-nums text-muted-foreground">
                      Due {date(expense.dueDate)}
                      {expense.paidDate && <span className="ml-2">Paid {date(expense.paidDate)}</span>}
                    </div>
                    <div className="-mr-1.5 justify-self-end"><ExpenseActions expense={expense} canEdit={canEdit} variant="compact" /></div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5 text-sm">
          <p className="text-muted-foreground">Page {page + 1} of {Math.max(totalPages, 1)}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 0} onClick={() => onPageChange(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => onPageChange(page + 1)}>Next</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
