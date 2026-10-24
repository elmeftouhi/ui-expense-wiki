import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ChartNoAxesCombined } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useActiveTenant } from '@/features/tenants'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { useExpenseStatistics } from '../hooks/useExpenses'
import type { ExpenseStatisticsFilters } from '../types'

function dateOnly(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function initialRange(): ExpenseStatisticsFilters {
  const today = new Date()
  return {
    startDate: dateOnly(new Date(today.getFullYear(), today.getMonth(), 1)),
    endDate: dateOnly(today),
  }
}

export function ExpenseStatisticsPage() {
  const { activeTenant } = useActiveTenant()
  const [range, setRange] = useState(initialRange)
  const stats = useExpenseStatistics(range)
  const invalidRange = Boolean(range.startDate && range.endDate && range.startDate > range.endDate)

  const amount = (value: number) => formatCurrency(value, { currency: activeTenant.currency, locale: activeTenant.locale })
  const tiles = [
    { label: 'Total expenses', value: stats.data?.totalExpenses },
    { label: 'Paid', value: stats.data?.totalPaid },
    { label: 'Pending', value: stats.data?.totalPending },
    { label: 'Overdue', value: stats.data?.totalOverdue },
  ]

  return (
    <div className="space-y-6">
      <Link to="/expenses" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All expenses</Link>
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Expense statistics</h1>
          <p className="mt-2 text-sm text-muted-foreground">Compare paid, pending, and overdue totals for a date range.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1 text-xs font-medium text-muted-foreground" htmlFor="statistics-start-date">From<Input id="statistics-start-date" type="date" value={range.startDate} max={range.endDate || undefined} onChange={(event) => setRange((current) => ({ ...current, startDate: event.target.value }))} /></label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground" htmlFor="statistics-end-date">To<Input id="statistics-end-date" type="date" value={range.endDate} min={range.startDate || undefined} onChange={(event) => setRange((current) => ({ ...current, endDate: event.target.value }))} /></label>
        </div>
      </header>
      {invalidRange && <p role="alert" className="text-sm text-destructive">Start date must be on or before end date.</p>}
      {stats.isLoading ? (
        <Card><CardContent className="p-8 text-sm text-muted-foreground">Loading statistics…</CardContent></Card>
      ) : stats.error ? (
        <Card><CardContent className="space-y-3 p-8 text-center"><ChartNoAxesCombined className="mx-auto h-8 w-8 text-muted-foreground" /><p role="alert" className="text-sm text-destructive">{getApiErrorMessage(stats.error, 'Statistics could not be loaded.')}</p><button type="button" className="text-sm underline" onClick={() => void stats.refetch()}>Try again</button></CardContent></Card>
      ) : stats.data ? (
        <>
          <section aria-label="Expense totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((tile) => <Card key={tile.label}><CardContent className="p-5"><p className="text-sm text-muted-foreground">{tile.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{amount(tile.value ?? 0)}</p></CardContent></Card>)}
          </section>
          <section className="grid gap-4 sm:grid-cols-2">
            <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Overdue expenses</p><p className="mt-2 text-2xl font-semibold tabular-nums">{stats.data.overdueCount}</p></CardContent></Card>
            <Card><CardContent className="p-5"><p className="text-sm text-muted-foreground">Pending expenses</p><p className="mt-2 text-2xl font-semibold tabular-nums">{stats.data.pendingCount}</p></CardContent></Card>
          </section>
          <Card>
            <CardContent className="p-5">
              <div className="mb-4"><h2 className="text-lg font-semibold">By category</h2><p className="mt-1 text-sm text-muted-foreground">Amounts and budget share in the selected period.</p></div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="py-3 pr-4 font-medium">Category</th><th className="py-3 pr-4 text-right font-medium">Expenses</th><th className="py-3 pr-4 text-right font-medium">Budget</th><th className="py-3 pr-4 text-right font-medium">Share</th><th className="w-32 py-3 font-medium">Progress</th></tr></thead>
                  <tbody className="divide-y divide-border/70">
                    {stats.data.byCategory.map((category) => <tr key={category.categoryId}>
                      <td className="py-3 pr-4 font-medium">{category.categoryName}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums">{amount(category.total)}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-right tabular-nums">{amount(category.budget)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{category.percentage.toLocaleString(activeTenant.locale, { maximumFractionDigits: 1 })}%</td>
                      <td className="py-3"><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(category.percentage, 100))}%` }} /></div></td>
                    </tr>)}
                    {stats.data.byCategory.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">No category expenses in this date range.</td></tr>}
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
