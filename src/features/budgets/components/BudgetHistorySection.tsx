import React, { useId, useState } from 'react'
import { AlertCircle, CalendarRange, RefreshCw, ShieldAlert } from 'lucide-react'
import { ApiClientError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { useBudgetHistory } from '../hooks/useBudgets'
import { BUDGET_HISTORY_MONTHS, isValidMonthsBack } from '../services/budgetService'
import type { BudgetPeriodResponse } from '../types'
import { formatDateRange, formatHistoryPeriodLabel, formatWarningThreshold } from '../utils/budgetMath'
import { fieldInputClass, fieldInvalidClass } from './FormControls'
import { PeriodStatusBadge } from './BudgetStatusBadges'

const HISTORY_PRESETS = [3, 6, 12, 24] as const
const CUSTOM = 'custom'

interface BudgetHistorySectionProps {
  budgetId: number
  currency: string
  locale?: string
}

export const BudgetHistorySection: React.FC<BudgetHistorySectionProps> = ({ budgetId, currency, locale }) => {
  const [monthsBack, setMonthsBack] = useState<number>(BUDGET_HISTORY_MONTHS.default)
  const [isCustom, setIsCustom] = useState(false)
  const [customDraft, setCustomDraft] = useState('')
  const [customError, setCustomError] = useState<string | null>(null)
  const selectId = useId()
  const customId = useId()

  const history = useBudgetHistory(budgetId, monthsBack)
  const money = (n: number) => formatCurrency(n, { currency, locale })

  const handleSelect = (value: string) => {
    if (value === CUSTOM) {
      setIsCustom(true)
      setCustomDraft(String(monthsBack))
      setCustomError(null)
      return
    }
    setIsCustom(false)
    setCustomError(null)
    setMonthsBack(Number(value))
  }

  const applyCustom = (event: React.FormEvent) => {
    event.preventDefault()
    const value = Number(customDraft)
    if (customDraft.trim() === '' || !isValidMonthsBack(value)) {
      setCustomError(`Enter a whole number between ${BUDGET_HISTORY_MONTHS.min} and ${BUDGET_HISTORY_MONTHS.max}.`)
      return
    }
    setCustomError(null)
    setMonthsBack(value)
  }

  const resetRange = () => {
    setIsCustom(false)
    setCustomError(null)
    setMonthsBack(BUDGET_HISTORY_MONTHS.default)
  }

  const isPreset = (HISTORY_PRESETS as readonly number[]).includes(monthsBack)
  const selectValue = isCustom || !isPreset ? CUSTOM : String(monthsBack)
  const isBadRange = history.error instanceof ApiClientError && history.error.status === 400

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 space-y-0 p-5 pb-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarRange className="h-4 w-4 text-primary" /> History
          </CardTitle>
          <CardDescription className="mt-1 text-xs">
            Month-by-month totals. Spent includes paid expenses only.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <div className="flex items-center gap-2">
            <label htmlFor={selectId} className="text-[11px] font-semibold text-muted-foreground">
              Months back
            </label>
            <select
              id={selectId}
              value={selectValue}
              onChange={(e) => handleSelect(e.target.value)}
              className={cn(fieldInputClass, 'h-8 w-auto pr-7')}
            >
              {HISTORY_PRESETS.map((n) => (
                <option key={n} value={n}>{n} months</option>
              ))}
              <option value={CUSTOM}>Custom…</option>
            </select>
          </div>
          {isCustom && (
            <form onSubmit={applyCustom} noValidate className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <label htmlFor={customId} className="sr-only">Custom months back</label>
                <input
                  id={customId}
                  type="number"
                  inputMode="numeric"
                  min={BUDGET_HISTORY_MONTHS.min}
                  max={BUDGET_HISTORY_MONTHS.max}
                  step={1}
                  value={customDraft}
                  onChange={(e) => setCustomDraft(e.target.value)}
                  aria-invalid={customError ? true : undefined}
                  aria-describedby={customError ? `${customId}-error` : undefined}
                  className={cn(fieldInputClass, 'h-8 w-20 font-mono tabular-nums', customError && fieldInvalidClass)}
                />
                <Button type="submit" variant="outline" size="sm" className="h-8 text-xs">Apply</Button>
              </div>
              {customError && (
                <p id={`${customId}-error`} role="alert" className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                  <AlertCircle className="h-3 w-3 shrink-0" /> {customError}
                </p>
              )}
            </form>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void history.refetch()}
            disabled={history.isFetching}
            aria-label="Refresh history"
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', history.isFetching && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {history.isLoading ? (
          <div className="space-y-2 p-5" aria-busy="true" aria-label="Loading history" data-testid="history-loading">
            {Array.from({ length: 4 }, (_, i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-muted" />)}
          </div>
        ) : isBadRange ? (
          <div role="alert" className="flex flex-col items-center gap-2 px-6 py-10 text-center text-xs">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            <p className="font-semibold text-foreground">That history range isn't supported</p>
            <p className="text-muted-foreground">
              Choose between {BUDGET_HISTORY_MONTHS.min} and {BUDGET_HISTORY_MONTHS.max} months.
            </p>
            <Button variant="outline" size="sm" onClick={resetRange} className="text-xs">
              Reset to {BUDGET_HISTORY_MONTHS.default} months
            </Button>
          </div>
        ) : history.isError ? (
          <div role="alert" className="flex flex-col items-center gap-2 px-6 py-10 text-center text-xs">
            <ShieldAlert className="h-6 w-6 text-destructive" />
            <p className="text-destructive">{getApiErrorMessage(history.error, 'Failed to load history.')}</p>
            <Button variant="outline" size="sm" onClick={() => void history.refetch()} className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
          </div>
        ) : !history.data || history.data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <CalendarRange className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">No history for this range</p>
            <p className="max-w-md text-xs text-muted-foreground">
              No budget periods were found in the last {monthsBack} {monthsBack === 1 ? 'month' : 'months'}.
            </p>
          </div>
        ) : (
          <HistoryTable rows={history.data} money={money} locale={locale} />
        )}
      </CardContent>
    </Card>
  )
}

const HistoryTable: React.FC<{
  rows: BudgetPeriodResponse[]
  money: (n: number) => string
  locale?: string
}> = ({ rows, money, locale }) => (
  <div className="custom-scrollbar overflow-x-auto">
    <table className="w-full min-w-[640px] text-xs" aria-label="Budget history">
      <thead>
        <tr className="border-b border-border/60 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          <th scope="col" className="px-4 py-2.5">Period</th>
          <th scope="col" className="px-4 py-2.5 text-right">Allocated</th>
          <th scope="col" className="px-4 py-2.5 text-right">Spent</th>
          <th scope="col" className="px-4 py-2.5 text-right">Remaining</th>
          <th scope="col" className="px-4 py-2.5">Status</th>
          <th scope="col" className="px-4 py-2.5 text-right">Warning threshold</th>
        </tr>
      </thead>
      <tbody>
        {/* Rows are rendered in API order (startDate desc). */}
        {rows.map((row) => {
          const remaining = row.allocatedAmount - row.spentAmount
          return (
            <tr key={row.id} className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/40">
              <td className="px-4 py-3">
                <div className="font-semibold text-foreground">{formatHistoryPeriodLabel(row, locale)}</div>
                <div className="text-[10px] text-muted-foreground">{formatDateRange(row, locale)}</div>
              </td>
              <td className="px-4 py-3 text-right font-mono tabular-nums">{money(row.allocatedAmount)}</td>
              <td className={cn('px-4 py-3 text-right font-mono tabular-nums', row.spentAmount === 0 && 'text-muted-foreground')}>
                {money(row.spentAmount)}
              </td>
              <td className={cn('px-4 py-3 text-right font-mono font-semibold tabular-nums', remaining < 0 && 'text-destructive')}>
                {money(remaining)}
              </td>
              <td className="px-4 py-3"><PeriodStatusBadge status={row.status} /></td>
              <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                {formatWarningThreshold(row.warningType, row.warningThreshold, money)}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
)
