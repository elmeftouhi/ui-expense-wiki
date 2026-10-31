import { useState } from 'react'
import { ChartNoAxesCombined, ChevronDown, ChevronRight, Folder, FolderOpen, Tag } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useActiveTenant } from '@/features/tenants'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { ExpenseViewsNav } from '../components/ExpenseViewsNav'
import { useExpenseStatistics } from '../hooks/useExpenses'
import type { ExpenseCategoryStatistic, ExpenseStatisticsFilters } from '../types'
import { currentMonthStatisticsRange } from '../utils/statisticsRange'

const categoryColors = [
  'bg-blue-500/10 text-blue-700 dark:text-blue-300',
  'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  'bg-violet-500/10 text-violet-700 dark:text-violet-300',
]

function CategoryRow({ category, amount, color, depth = 0 }: {
  category: ExpenseCategoryStatistic
  amount: (value: number) => string
  color: string
  depth?: number
}) {
  const [expanded, setExpanded] = useState(false)
  const hasChildren = category.subCategories.length > 0
  const Icon = hasChildren ? (expanded ? FolderOpen : Folder) : Tag
  const Chevron = expanded ? ChevronDown : ChevronRight
  const label = (
    <>
      <span className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color}`}>
        <Icon aria-hidden="true" className="h-4 w-4" />
      </span>
      <span className="min-w-0 break-words">{category.categoryName}</span>
    </>
  )

  return (
    <>
      <tr className={depth === 0 ? 'hover:bg-muted/40' : 'bg-muted/20 hover:bg-muted/40'}>
        <td className="py-3 pr-4 font-medium" style={{ paddingLeft: `${depth * 1.5}rem` }}>
          {hasChildren ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={`${expanded ? 'Collapse' : 'Expand'} ${category.categoryName}`}
              onClick={() => setExpanded((current) => !current)}
              className="flex w-full items-center gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Chevron aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
              {label}
            </button>
          ) : <div className="flex items-center gap-2 pl-6">{label}</div>}
        </td>
        <td className="whitespace-nowrap py-3 pr-4 text-right font-mono tabular-nums">{amount(category.total)}</td>
      </tr>
      {expanded && category.subCategories.map((child) => (
        <CategoryRow key={child.categoryId} category={child} amount={amount} color={color} depth={depth + 1} />
      ))}
    </>
  )
}

export function ExpenseStatisticsPage() {
  const { activeTenant } = useActiveTenant()
  const [range, setRange] = useState<ExpenseStatisticsFilters>(currentMonthStatisticsRange)
  const stats = useExpenseStatistics(range)
  const isWideHeader = useMediaQuery('(min-width: 1024px)', true)
  const invalidRange = Boolean(range.startDate && range.endDate && range.startDate > range.endDate)

  const amount = (value: number) => formatCurrency(value, { currency: activeTenant.currency, locale: activeTenant.locale })
  const tiles = [
    { label: 'Total expenses', value: stats.data?.totalExpenses },
    { label: 'Paid', value: stats.data?.totalPaid },
    { label: 'Pending', value: stats.data?.totalPending },
    { label: 'Overdue', value: stats.data?.totalOverdue },
  ]

  return (
    <div className="space-y-4">
      <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">Expense statistics</h1>
          {isWideHeader && <ExpenseViewsNav active="statistics" />}
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:w-auto">
          <label className="space-y-1 text-xs font-medium text-muted-foreground" htmlFor="statistics-start-date">From<Input id="statistics-start-date" type="date" className="h-9 text-xs sm:text-sm" value={range.startDate} max={range.endDate || undefined} onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground" htmlFor="statistics-end-date">To<Input id="statistics-end-date" type="date" className="h-9 text-xs sm:text-sm" value={range.endDate} min={range.startDate || undefined} onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))} /></label>
        </div>
      </header>
      {!isWideHeader && <ExpenseViewsNav active="statistics" />}
      {invalidRange && <p role="alert" className="text-sm text-destructive">Start date must be on or before end date.</p>}
      {stats.isLoading ? (
        <Card><CardContent className="p-8 text-sm text-muted-foreground">Loading statistics…</CardContent></Card>
      ) : stats.error ? (
        <Card><CardContent className="space-y-3 p-8 text-center"><ChartNoAxesCombined className="mx-auto h-8 w-8 text-muted-foreground" /><p role="alert" className="text-sm text-destructive">{getApiErrorMessage(stats.error, 'Statistics could not be loaded.')}</p><button type="button" className="text-sm underline" onClick={() => void stats.refetch()}>Try again</button></CardContent></Card>
      ) : stats.data ? (
        <>
          <section aria-label="Expense totals" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {tiles.map((tile) => <Card key={tile.label}><CardContent className="p-4 sm:p-5"><p className="text-xs sm:text-sm text-muted-foreground">{tile.label}</p><p className="mt-1.5 text-lg sm:text-2xl font-bold font-mono tabular-nums">{amount(tile.value ?? 0)}</p></CardContent></Card>)}
          </section>
          <section className="grid grid-cols-2 gap-3 sm:gap-4">
            <Card><CardContent className="p-4 sm:p-5"><p className="text-xs sm:text-sm text-muted-foreground">Overdue expenses</p><p className="mt-1.5 text-lg sm:text-2xl font-bold font-mono tabular-nums">{stats.data.overdueCount}</p></CardContent></Card>
            <Card><CardContent className="p-4 sm:p-5"><p className="text-xs sm:text-sm text-muted-foreground">Pending expenses</p><p className="mt-1.5 text-lg sm:text-2xl font-bold font-mono tabular-nums">{stats.data.pendingCount}</p></CardContent></Card>
          </section>
          <Card>
            <CardContent className="p-4 sm:p-5">
              <div className="mb-4"><h2 className="text-base sm:text-lg font-semibold">By category</h2><p className="mt-1 text-xs sm:text-sm text-muted-foreground">Expand a category to see its subcategories.</p></div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-3 pr-4 font-medium">Category</th><th className="py-3 pr-4 text-right font-medium">Expenses</th></tr></thead>
                  <tbody key={`${activeTenant.id}-${range.startDate}-${range.endDate}`} className="divide-y divide-border/70">
                    {stats.data.byCategory.map((category, index) => (
                      <CategoryRow key={category.categoryId} category={category} amount={amount} color={categoryColors[index % categoryColors.length]} />
                    ))}
                    {stats.data.byCategory.length === 0 && <tr><td colSpan={2} className="py-12 text-center text-muted-foreground">No category expenses in this date range.</td></tr>}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
