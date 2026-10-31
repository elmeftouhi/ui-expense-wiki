import React from 'react'
import { PieChart as PieChartIcon, ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import type { ExpenseStatisticsResponse } from '@/features/expenses'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'

const categoryColors = ['#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4']

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
  const categories = (statistics?.byCategory ?? [])
    .filter((category) => category.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((category, index) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      amount: category.total,
      percentage: statistics && statistics.totalExpenses > 0
        ? category.total / statistics.totalExpenses * 100
        : 0,
      color: categoryColors[index % categoryColors.length],
    }))

  return (
    <Card className="border-border/80 shadow-xs flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary" />
              <span>Spending by Category</span>
            </CardTitle>
            <span className="text-xs text-muted-foreground font-medium">This Month</span>
          </div>
          <CardDescription>
            Month-to-date expense totals by top-level category, including subcategories.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {isLoading ? (
            <p role="status" className="text-sm text-muted-foreground">Loading category spending...</p>
          ) : error ? (
            <div className="space-y-2">
              <p role="alert" className="text-sm text-destructive">
                {statistics ? 'Could not refresh category spending; showing last loaded values. ' : ''}
                {getApiErrorMessage(error, 'Category spending could not be loaded.')}
              </p>
              <Button variant="outline" size="sm" onClick={onRetry} disabled={isFetching}>
                Retry category spending
              </Button>
            </div>
          ) : null}
          {!isLoading && !error && categories.length === 0 && (
            <p className="text-sm text-muted-foreground">No category expenses this month.</p>
          )}
          {categories.length > 0 && (
            <>
              <div className="relative h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="amount"
                      nameKey="categoryName"
                      innerRadius="58%"
                      outerRadius="90%"
                      paddingAngle={categories.length > 1 ? 2 : 0}
                      stroke="none"
                      isAnimationActive={false}
                    >
                      {categories.map((cat) => (
                        <Cell key={cat.categoryId} fill={cat.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        const cat = payload[0].payload as (typeof categories)[number]
                        return (
                          <div className="rounded-xl border border-border/80 bg-card text-card-foreground p-2.5 shadow-xl text-xs space-y-1 min-w-[150px]">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                              <span>{cat.categoryName}</span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-mono font-bold">{formatCurrency(cat.amount, { currency, locale })}</span>
                              <span className="font-mono text-muted-foreground">{cat.percentage.toFixed(1)}%</span>
                            </div>
                          </div>
                        )
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[11px] text-muted-foreground">Total</span>
                  <span className="text-sm font-semibold font-mono text-foreground">
                    {formatCurrency(statistics?.totalExpenses ?? 0, { currency, locale })}
                  </span>
                </div>
              </div>

              <ul className="space-y-1.5 text-xs" aria-label="Category spending">
                {categories.map((cat) => (
                  <li key={cat.categoryId} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="font-medium text-foreground truncate">{cat.categoryName}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-muted-foreground text-[11px]">
                        {cat.percentage.toFixed(1)}%
                      </span>
                      <span className="font-semibold font-mono text-foreground">
                        {formatCurrency(cat.amount, { currency, locale })}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </div>

      <div className="p-4 pt-3 border-t border-border/60 mt-3 bg-muted/20 rounded-b-xl flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {statistics ? `${categories.length} spending categories` : 'Category spending unavailable'}
        </span>
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <Link to="/categories">
            <span>View All Categories</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  )
}
