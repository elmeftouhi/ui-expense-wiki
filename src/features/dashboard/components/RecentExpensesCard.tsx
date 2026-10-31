import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Plus, ReceiptText } from 'lucide-react'
import type { ExpensePageResponse, ExpenseResponse } from '@/features/expenses'
import { ExpenseStatusBadge } from '@/features/expenses/components/ExpenseStatusBadge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'

interface RecentExpensesCardProps {
  pageData: ExpensePageResponse | undefined
  isLoading: boolean
  error: Error | null
  onRetry: () => void
  isFetching: boolean
  canEdit: boolean
  currency: string
  locale: string
}

function formatDueDateShort(isoDate: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return isoDate
  const utcMs = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const currentYear = new Date().getFullYear()
  const year = Number(match[1])
  try {
    return new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      ...(year !== currentYear ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    }).format(new Date(utcMs))
  } catch {
    return isoDate
  }
}

function formatAddedCue(createdAt: string, locale: string, now = new Date()): string | null {
  if (!createdAt) return null
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime())) return null

  const diffMs = now.getTime() - created.getTime()
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes >= 0 && diffMinutes < 1) return 'Added just now'
  if (diffMinutes >= 1 && diffMinutes < 60) return `Added ${diffMinutes}m ago`

  const isSameDay =
    created.getFullYear() === now.getFullYear() &&
    created.getMonth() === now.getMonth() &&
    created.getDate() === now.getDate()
  if (isSameDay) return 'Added today'

  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
  const isYesterday =
    created.getFullYear() === yesterday.getFullYear() &&
    created.getMonth() === yesterday.getMonth() &&
    created.getDate() === yesterday.getDate()
  if (isYesterday) return 'Added yesterday'

  try {
    const shortDate = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
    }).format(created)
    return `Added ${shortDate}`
  } catch {
    return null
  }
}

export const RecentExpensesCard: React.FC<RecentExpensesCardProps> = ({
  pageData,
  isLoading,
  error,
  onRetry,
  isFetching,
  canEdit,
  currency,
  locale,
}) => {
  const expenses: ExpenseResponse[] = (pageData?.content ?? []).slice(0, 5)
  const totalCount = pageData?.totalElements ?? expenses.length

  return (
    <Card className="border-border/80 shadow-xs overflow-hidden">
      <CardHeader className="pb-2.5 pt-4 px-4 sm:px-5 border-b border-border/50">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
            <ReceiptText className="w-4 h-4 text-primary shrink-0" />
            <span>Recent expenses</span>
          </CardTitle>
          <span className="text-[11px] text-muted-foreground font-medium">
            Last 5 added
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {isLoading ? (
          <p role="status" className="px-4 sm:px-5 py-6 text-xs sm:text-sm text-muted-foreground">
            Loading recent expenses...
          </p>
        ) : null}

        {!isLoading && error ? (
          <div className="px-4 sm:px-5 py-3.5 space-y-2 border-b border-border/50">
            <p role="alert" className="text-xs text-destructive">
              {pageData ? 'Could not refresh recent expenses; showing last loaded entries. ' : ''}
              {getApiErrorMessage(error, 'Recent expenses could not be loaded.')}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={onRetry}
              disabled={isFetching}
            >
              Retry recent expenses
            </Button>
          </div>
        ) : null}

        {!isLoading && !error && expenses.length === 0 ? (
          <div className="px-4 sm:px-5 py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              No expenses recorded yet.
            </p>
            {canEdit && (
              <Button asChild variant="outline" size="sm" className="h-8 text-xs gap-1.5 self-start sm:self-auto">
                <Link to="/expenses/new">
                  <Plus className="w-3.5 h-3.5" />
                  <span>New expense</span>
                </Link>
              </Button>
            )}
          </div>
        ) : null}

        {expenses.length > 0 && (
          <ul aria-label="Recent expenses" className="divide-y divide-border/50">
            {expenses.map((expense) => {
              const dueLabel = formatDueDateShort(expense.dueDate, locale)
              const addedCue = formatAddedCue(expense.createdAt, locale)

              return (
                <li key={expense.id}>
                  <Link
                    to={`/expenses/${expense.id}`}
                    className="flex items-center justify-between gap-3 px-4 sm:px-5 py-2.5 hover:bg-muted/35 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-[13px] font-medium text-foreground truncate">
                        {expense.description}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground truncate">
                        <span>{expense.categoryName}</span>
                        <span className="mx-1.5 opacity-60">·</span>
                        <span>Due {dueLabel}</span>
                        {addedCue && (
                          <>
                            <span className="mx-1.5 opacity-60">·</span>
                            <span>{addedCue}</span>
                          </>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <ExpenseStatusBadge status={expense.status} compact />
                      <span className="font-mono tabular-nums font-semibold text-xs sm:text-[13px] text-foreground">
                        {formatCurrency(expense.amount, {
                          currency: expense.currency || currency,
                          locale,
                        })}
                      </span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>

      <div className="px-4 sm:px-5 py-2.5 border-t border-border/60 bg-muted/15 flex items-center justify-between text-xs">
        <span className="text-muted-foreground text-[11px]">
          {pageData
            ? `${expenses.length} of ${totalCount} ${totalCount === 1 ? 'expense' : 'expenses'}`
            : 'Recent ledger entries'}
        </span>
        <Link
          to="/expenses?sort=createdAt&direction=desc"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground hover:text-primary transition-colors"
        >
          <span>All expenses</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </Card>
  )
}

