import { useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowDown, ArrowUp, CreditCard, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { CategoryIcon } from '@/features/categories/components/CategoryIcon'
import type { CategoryOption } from '@/features/budgets/utils/categoryOptions'
import { useActiveTenant } from '@/features/tenants'
import { formatCurrency } from '@/lib/formatters'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { ExpenseActions } from './ExpenseActions'
import { ExpenseStatusBadge } from './ExpenseStatusBadge'
import { SubscriptionOriginBadge } from './SubscriptionOriginBadge'
import { getExpenseDateCue, groupExpensesByDate, isDateSorted } from '../utils/dateGroups'
import type { ExpenseResponse, ExpenseSortField, SortDirection } from '../types'

const SORT_LABELS: Record<ExpenseSortField, string> = {
  dueDate: 'Due date',
  description: 'Description',
  amount: 'Amount',
  createdAt: 'Date added',
}

function CategoryBadgeSwatch({
  category,
  size = 'md',
}: {
  category?: CategoryOption
  size?: 'md' | 'lg'
}) {
  const hasCustomColor = Boolean(category?.backgroundColor)
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center border border-border/50',
        size === 'lg' ? 'h-9 w-9 rounded-xl' : 'h-8 w-8 rounded-lg',
        !hasCustomColor && 'bg-muted/70 text-muted-foreground',
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
  categories,
  onCategoryFilter,
  fromSearch,
  totalElements,
  pageSize,
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
  categories?: CategoryOption[]
  onCategoryFilter?: (categoryId: number) => void
  fromSearch?: string
  totalElements?: number
  pageSize?: number
}) {
  const { activeTenant } = useActiveTenant()
  const navigate = useNavigate()
  const containerRef = useRef<HTMLDivElement>(null)
  // Falls back to the table when matchMedia is unavailable (tests, SSR).
  const isDesktop = useMediaQuery('(min-width: 768px)', true)

  const categoryById = useMemo(
    () => new Map<number, CategoryOption>((categories ?? []).map((item) => [item.id, item])),
    [categories],
  )

  const money = (expense: ExpenseResponse) =>
    formatCurrency(expense.amount, { currency: expense.currency, locale: activeTenant.locale })

  const DirectionIcon = direction === 'asc' ? ArrowUp : ArrowDown
  const linkState = fromSearch ? { fromExpensesSearch: fromSearch } : undefined

  const changePage = (nextPage: number) => {
    onPageChange(nextPage)
    containerRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' })
  }

  const sortable = (field: ExpenseSortField, label: string, alignRight = false) => (
    <button
      type="button"
      onClick={() => onSort?.(field)}
      disabled={!onSort}
      className={cn(
        'inline-flex items-center gap-1 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:hover:text-inherit cursor-pointer',
        alignRight && 'flex-row-reverse',
        sort === field && 'text-foreground font-semibold',
      )}
    >
      {label}
      {sort === field && <DirectionIcon className="h-3 w-3" aria-label={direction === 'asc' ? 'ascending' : 'descending'} />}
    </button>
  )

  const empty = (
    <div className="px-4 py-14 text-center">
      <p className="font-medium text-foreground">{emptyMessage}</p>
      <p className="mt-1 text-sm text-muted-foreground">Try changing the filters or record an expense.</p>
      {canEdit && (
        <Button asChild size="sm" className="mt-4">
          <Link to="/expenses/new" state={linkState}>Record expense</Link>
        </Button>
      )}
    </div>
  )

  const renderCategoryMeta = (expense: ExpenseResponse) =>
    onCategoryFilter ? (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onCategoryFilter(expense.categoryId)
        }}
        title={`Filter by ${expense.categoryName}`}
        className="truncate rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      >
        {expense.categoryName}
      </button>
    ) : (
      <span className="truncate">{expense.categoryName}</span>
    )

  const renderMobileCard = (expense: ExpenseResponse, groupedByDate: boolean) => {
    const category = categoryById.get(expense.categoryId)
    const dateCue = getExpenseDateCue(expense, activeTenant.locale)
    const isOverdue = expense.status === 'OVERDUE' || dateCue.tone === 'urgent'

    return (
      <div
        key={expense.id}
        role="listitem"
        onClick={(event) => {
          if (!event.currentTarget.contains(event.target as Node)) return
          navigate(`/expenses/${expense.id}`, { state: linkState })
        }}
        className={cn(
          'flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-muted/25 active:bg-accent/60 cursor-pointer',
          isOverdue && 'border-l-2 border-l-destructive bg-destructive/[0.025]',
        )}
      >
        <CategoryBadgeSwatch category={category} size="lg" />

        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Link
              to={`/expenses/${expense.id}`}
              state={linkState}
              onClick={(event) => event.stopPropagation()}
              className="truncate text-sm font-semibold text-foreground underline-offset-4 hover:underline"
            >
              {expense.description}
            </Link>
            {expense.notes?.trim() && (
              <span title={expense.notes} aria-label="Has notes" className="shrink-0 text-muted-foreground">
                <FileText className="h-3 w-3" aria-hidden="true" />
              </span>
            )}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            {renderCategoryMeta(expense)}
            {expense.paymentMethod && (
              <span className="inline-flex items-center gap-1 truncate text-muted-foreground/85">
                <span aria-hidden="true">·</span>
                <span className="truncate">{expense.paymentMethod}</span>
              </span>
            )}
            <SubscriptionOriginBadge expense={expense} />
            {dateCue.relativeCue ? (
              <span
                className={cn(
                  'font-medium tabular-nums',
                  dateCue.tone === 'urgent'
                    ? 'text-destructive'
                    : 'text-amber-700 dark:text-amber-400',
                )}
              >
                · {dateCue.relativeCue}
              </span>
            ) : !groupedByDate ? (
              <span className="tabular-nums">· {dateCue.primary}</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
              {money(expense)}
            </span>
            <ExpenseStatusBadge status={expense.status} compact />
          </div>

          {canEdit && (
            <div className="-mr-1.5">
              <ExpenseActions expense={expense} canEdit={canEdit} variant="compact" fromSearch={fromSearch} />
            </div>
          )}
        </div>
      </div>
    )
  }

  const mobileGroups = useMemo(() => {
    if (isDesktop || !isDateSorted(sort)) return null
    return groupExpensesByDate(expenses, {
      sort,
      locale: activeTenant.locale,
      tenantCurrency: activeTenant.currency,
    })
  }, [activeTenant.currency, activeTenant.locale, expenses, isDesktop, sort])

  const rangeStart = totalElements && pageSize ? Math.min(page * pageSize + 1, totalElements) : null
  const rangeEnd = totalElements && pageSize ? Math.min(page * pageSize + expenses.length, totalElements) : null

  return (
    <Card ref={containerRef} className="overflow-hidden border-border/80 shadow-xs">
      <CardContent className="p-0">
        {isDesktop ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border/80 bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">{sortable('description', 'Expense')}</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">{sortable('amount', 'Amount', true)}</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">{sortable('dueDate', 'Due date')}</th>
                  <th scope="col" className="w-px px-2.5 py-2.5"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {expenses.map((expense) => {
                  const category = categoryById.get(expense.categoryId)
                  const dateCue = getExpenseDateCue(expense, activeTenant.locale)
                  const isOverdue = expense.status === 'OVERDUE' || dateCue.tone === 'urgent'

                  return (
                    <tr
                      key={expense.id}
                      className={cn(
                        'transition-colors hover:bg-muted/25',
                        isOverdue && 'bg-destructive/[0.02]',
                      )}
                    >
                      <td className={cn('px-4 py-2.5', isOverdue && 'border-l-2 border-l-destructive')}>
                        <div className="flex items-center gap-3 min-w-0">
                          <CategoryBadgeSwatch category={category} />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Link
                                to={`/expenses/${expense.id}`}
                                state={linkState}
                                className="font-medium text-foreground underline-offset-4 hover:underline"
                              >
                                {expense.description}
                              </Link>
                              {expense.notes?.trim() && (
                                <span
                                  title={expense.notes}
                                  aria-label="Has notes"
                                  className="inline-flex text-muted-foreground"
                                >
                                  <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                              )}
                              <SubscriptionOriginBadge expense={expense} />
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                              {renderCategoryMeta(expense)}
                              {expense.paymentMethod && (
                                <span className="inline-flex items-center gap-1 text-muted-foreground/85">
                                  <CreditCard className="h-3 w-3 shrink-0 opacity-70" aria-hidden="true" />
                                  <span>{expense.paymentMethod}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-mono font-semibold tabular-nums text-foreground">
                        {money(expense)}
                      </td>

                      <td className="px-4 py-2.5">
                        <ExpenseStatusBadge status={expense.status} />
                      </td>

                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                        <span className="text-muted-foreground">{dateCue.primary}</span>
                        {dateCue.relativeCue && (
                          <span
                            className={cn(
                              'block text-xs font-medium',
                              dateCue.tone === 'urgent'
                                ? 'text-destructive'
                                : 'text-amber-700 dark:text-amber-400',
                            )}
                          >
                            {dateCue.relativeCue}
                          </span>
                        )}
                        {!dateCue.relativeCue && dateCue.secondary && dateCue.secondary !== 'Settled' && (
                          <span className="block text-xs text-muted-foreground">{dateCue.secondary}</span>
                        )}
                      </td>

                      <td className="px-2.5 py-2.5">
                        <ExpenseActions expense={expense} canEdit={canEdit} variant="compact" fromSearch={fromSearch} />
                      </td>
                    </tr>
                  )
                })}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={5}>{empty}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <>
            {onSort && (
              <div className="flex items-center gap-2 border-b border-border/70 bg-muted/25 px-3.5 py-2 text-xs text-muted-foreground">
                <label htmlFor="expense-mobile-sort" className="shrink-0 font-medium">Sort by</label>
                <select
                  id="expense-mobile-sort"
                  value={sort ?? ''}
                  onChange={(event) => onSort(event.target.value as ExpenseSortField)}
                  className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground"
                >
                  {!sort && <option value="">Default</option>}
                  {(Object.keys(SORT_LABELS) as ExpenseSortField[]).map((field) => (
                    <option key={field} value={field}>{SORT_LABELS[field]}</option>
                  ))}
                </select>
                {sort && (
                  <button
                    type="button"
                    onClick={() => onSort(sort)}
                    aria-label={direction === 'asc' ? 'Sort descending' : 'Sort ascending'}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-input bg-background text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <DirectionIcon className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
            )}

            {expenses.length === 0 ? (
              empty
            ) : mobileGroups ? (
              <div role="list" aria-label="Expense list" className="divide-y divide-border/70">
                {mobileGroups.map((group) => (
                  <div key={group.dateKey}>
                    <div className="sticky top-16 z-10 flex items-center justify-between gap-2 border-b border-border/50 bg-muted/45 px-3.5 py-1.5 text-[11px] backdrop-blur-xs">
                      <span className="font-semibold text-muted-foreground">{group.label}</span>
                      <span className="font-mono font-semibold tabular-nums text-foreground/85">
                        {group.subtotal !== null
                          ? formatCurrency(group.subtotal, { currency: group.currency, locale: activeTenant.locale })
                          : `${group.items.length} items`}
                      </span>
                    </div>
                    <div className="divide-y divide-border/50">
                      {group.items.map((item) => renderMobileCard(item, true))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div role="list" aria-label="Expense list" className="divide-y divide-border/60">
                {expenses.map((item) => renderMobileCard(item, false))}
              </div>
            )}
          </>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-border/80 bg-muted/15 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <p>Page {page + 1} of {Math.max(totalPages, 1)}</p>
            {rangeStart !== null && rangeEnd !== null && totalElements !== undefined && totalElements > 0 && (
              <span className="hidden sm:inline text-xs font-mono tabular-nums text-muted-foreground/80">
                ({rangeStart}–{rangeEnd} of {totalElements})
              </span>
            )}
          </div>
          <div className="flex gap-1.5 sm:gap-2">
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" disabled={page <= 0} onClick={() => changePage(page - 1)}>
              Previous
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" disabled={page + 1 >= totalPages} onClick={() => changePage(page + 1)}>
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
