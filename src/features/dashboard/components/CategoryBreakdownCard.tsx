import React, { useState } from 'react'
import { PieChart as PieChartIcon, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ExpenseStatisticsResponse } from '@/features/expenses'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'

const categoryColors = ['#2563eb', '#0d9488', '#7c3aed', '#d97706', '#db2777', '#0891b2']
const DEFAULT_VISIBLE_LIMIT = 4

interface CategoryBreakdownCardProps {
  statistics: ExpenseStatisticsResponse | undefined
  isLoading: boolean
  error: Error | null
  onRetry: () => void
  isFetching: boolean
  currency: string
  locale: string
}

export const CategoryBreakdownCard: React.FC<CategoryBreakdownCardProps> = ({
  statistics,
  isLoading,
  error,
  onRetry,
  isFetching,
  currency,
  locale,
}) => {
  const [expanded, setExpanded] = useState(false)

  const categories = (statistics?.byCategory ?? [])
    .filter((category) => category.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((category, index) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      amount: category.total,
      percentage: statistics && statistics.totalExpenses > 0
        ? (category.total / statistics.totalExpenses) * 100
        : 0,
      color: categoryColors[index % categoryColors.length],
    }))

  const hasOverflow = categories.length > DEFAULT_VISIBLE_LIMIT
  const visibleCategories = expanded || !hasOverflow
    ? categories
    : categories.slice(0, DEFAULT_VISIBLE_LIMIT)
  const hiddenCategories = !expanded && hasOverflow
    ? categories.slice(DEFAULT_VISIBLE_LIMIT)
    : []
  const otherAmount = hiddenCategories.reduce((sum, cat) => sum + cat.amount, 0)
  const otherPercentage = hiddenCategories.reduce((sum, cat) => sum + cat.percentage, 0)

  return (
    <Card className="border-border/80 shadow-xs flex flex-col justify-between">
      <div>
        <CardHeader className="pb-2.5 pt-4 px-4 sm:px-5">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm sm:text-base font-semibold flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary shrink-0" />
              <span>Spending by category</span>
            </CardTitle>
            <span className="text-[11px] text-muted-foreground font-medium">Month to date</span>
          </div>
        </CardHeader>

        <CardContent className="space-y-3.5 pt-1 pb-4 px-4 sm:px-5">
          {isLoading ? (
            <p role="status" className="text-sm text-muted-foreground py-2">Loading category spending...</p>
          ) : error ? (
            <div className="space-y-2">
              <p role="alert" className="text-xs text-destructive">
                {statistics ? 'Could not refresh category spending; showing last loaded values. ' : ''}
                {getApiErrorMessage(error, 'Category spending could not be loaded.')}
              </p>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onRetry} disabled={isFetching}>
                Retry category spending
              </Button>
            </div>
          ) : null}

          {!isLoading && !error && categories.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No category expenses this month.</p>
          )}

          {categories.length > 0 && (
            <>
              {/* Compact Proportional Allocation Bar (replaces tall donut) */}
              <div
                className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted gap-0.5"
                aria-hidden="true"
              >
                {visibleCategories.map((cat) => (
                  <div
                    key={cat.categoryId}
                    className="h-full first:rounded-l-full last:rounded-r-full transition-all"
                    style={{
                      width: `${Math.max(cat.percentage, 2)}%`,
                      backgroundColor: cat.color,
                    }}
                    title={`${cat.categoryName}: ${formatCurrency(cat.amount, { currency, locale })} (${cat.percentage.toFixed(1)}%)`}
                  />
                ))}
                {hiddenCategories.length > 0 && (
                  <div
                    className="h-full rounded-r-full bg-slate-400 dark:bg-slate-600 transition-all"
                    style={{ width: `${Math.max(otherPercentage, 2)}%` }}
                    title={`Other (${hiddenCategories.length}): ${formatCurrency(otherAmount, { currency, locale })} (${otherPercentage.toFixed(1)}%)`}
                  />
                )}
              </div>

              {/* Ranked Category Rows (capped to Top 4 + Other unless expanded) */}
              <ul className="space-y-2 text-xs" aria-label="Category spending">
                {visibleCategories.map((cat) => (
                  <li key={cat.categoryId} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium text-foreground truncate">{cat.categoryName}</span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono tabular-nums text-muted-foreground text-[11px]">
                        {cat.percentage.toFixed(1)}%
                      </span>
                      <span className="font-semibold font-mono tabular-nums text-foreground">
                        {formatCurrency(cat.amount, { currency, locale })}
                      </span>
                    </div>
                  </li>
                ))}

                {hiddenCategories.length > 0 && (
                  <li className="flex items-center justify-between gap-2 text-muted-foreground pt-0.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0 bg-slate-400 dark:bg-slate-600" />
                      <span className="truncate">Other ({hiddenCategories.length})</span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono tabular-nums text-[11px]">
                        {otherPercentage.toFixed(1)}%
                      </span>
                      <span className="font-medium font-mono tabular-nums text-foreground">
                        {formatCurrency(otherAmount, { currency, locale })}
                      </span>
                    </div>
                  </li>
                )}
              </ul>

              {hasOverflow && (
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => !prev)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
                >
                  {expanded ? (
                    <>
                      <span>Show top {DEFAULT_VISIBLE_LIMIT}</span>
                      <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      <span>Show all {categories.length} categories</span>
                      <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </CardContent>
      </div>

      <div className="px-4 sm:px-5 py-2.5 border-t border-border/60 bg-muted/15 rounded-b-xl flex items-center justify-between text-xs">
        <span className="text-muted-foreground text-[11px]">
          {statistics ? `${categories.length} spending categories` : 'Category spending unavailable'}
        </span>
        <Link
          to="/expenses/statistics"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-foreground hover:text-primary transition-colors"
        >
          <span>Full breakdown</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </Card>
  )
}
