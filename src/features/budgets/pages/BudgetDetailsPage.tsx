import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BellRing,
  CircleDashed,
  Pencil,
  RefreshCw,
  SearchX,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { ApiClientError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { BudgetCreateRequest, BudgetPeriod, BudgetPeriodUpdateRequest } from '../types'
import { useBudget, useBudgetPeriods, useUpdateBudget, useUpdateBudgetPeriod } from '../hooks/useBudgets'
import { useCategoryOptions } from '../hooks/useCategoryOptions'
import {
  PERIODICITY_LABELS,
  formatDateRange,
  formatPeriodLabel,
  formatWarningThreshold,
  getBudgetHealth,
  summarizePeriod,
} from '../utils/budgetMath'
import { BudgetHealthBadge, PeriodStatusBadge } from '../components/BudgetStatusBadges'
import { BudgetProgressBar } from '../components/BudgetProgressBar'
import { BudgetCategoryChips } from '../components/BudgetCategoryChips'
import { BudgetFormModal } from '../components/BudgetFormModal'
import { PeriodEditModal } from '../components/PeriodEditModal'
import { PeriodHistoryTable } from '../components/PeriodHistoryTable'
import { BudgetHistorySection } from '../components/BudgetHistorySection'

const BackLink: React.FC = () => (
  <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground">
    <Link to="/budgets">
      <ArrowLeft className="h-3.5 w-3.5" /> Budgets
    </Link>
  </Button>
)

export const BudgetDetailsPage: React.FC = () => {
  const { activeTenant } = useActiveTenant()
  const { budgetId } = useParams<{ budgetId: string }>()
  return <BudgetDetailsContent key={`${activeTenant.id}:${budgetId}`} />
}

const BudgetDetailsContent: React.FC = () => {
  const { budgetId: rawId } = useParams<{ budgetId: string }>()
  const parsedId = Number(rawId)
  const budgetId = Number.isSafeInteger(parsedId) && parsedId > 0 ? parsedId : undefined

  const { activeTenant, canEdit } = useActiveTenant()
  const toast = useToast()
  const budgetQuery = useBudget(budgetId)
  const periodsQuery = useBudgetPeriods(budgetId)
  const categories = useCategoryOptions()
  const updateBudget = useUpdateBudget()
  const updatePeriod = useUpdateBudgetPeriod(budgetId ?? 0)

  const [isEditOpen, setIsEditOpen] = useState(false)
  const [adjustingPeriod, setAdjustingPeriod] = useState<BudgetPeriod | null>(null)

  const money = (n: number) => formatCurrency(n, { currency: activeTenant.currency, locale: activeTenant.locale })

  const isNotFound =
    budgetId === undefined || (budgetQuery.error instanceof ApiClientError && budgetQuery.error.status === 404)

  if (isNotFound) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <SearchX className="h-7 w-7 text-muted-foreground" />
            <h1 className="text-base font-semibold text-foreground">Budget not found</h1>
            <p className="max-w-xs text-xs text-muted-foreground">
              This budget may have been removed or belongs to another workspace.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (budgetQuery.isLoading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading budget">
        <BackLink />
        <div className="h-7 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="h-44 animate-pulse rounded-xl bg-muted" />
        <div className="h-56 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (budgetQuery.isError || !budgetQuery.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-7 w-7 text-destructive" />
            <h1 className="text-sm font-semibold text-foreground">Couldn&apos;t load this budget</h1>
            <p className="text-xs text-muted-foreground">{getApiErrorMessage(budgetQuery.error)}</p>
            <Button variant="outline" size="sm" onClick={() => void budgetQuery.refetch()} className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const budget = budgetQuery.data
  const current = budget.currentPeriod ?? null
  const summary = current ? summarizePeriod(current) : null
  const health = getBudgetHealth(budget)

  const handleBudgetSubmit = async (payload: BudgetCreateRequest) => {
    try {
      await updateBudget.mutateAsync({ id: budget.id, payload })
      toast.success('Budget updated', `“${payload.name}” has been saved.`)
    } catch (err) {
      toast.error('Could not update budget', getApiErrorMessage(err))
      throw err
    }
  }

  const handlePeriodSubmit = async (periodId: number, payload: BudgetPeriodUpdateRequest) => {
    try {
      const updated = await updatePeriod.mutateAsync({ periodId, payload })
      toast.success(
        'Period updated',
        `${formatPeriodLabel(updated, budget.periodicity, activeTenant.locale)} now has ${money(updated.allocatedAmount)} allocated.`,
      )
    } catch (err) {
      toast.error('Could not update period', getApiErrorMessage(err))
      throw err
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1.5">
        <BackLink />
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {budget.name}
              </h1>
              <BudgetHealthBadge health={health} />
              <span className="text-xs text-muted-foreground">
                {PERIODICITY_LABELS[budget.periodicity]}
                {!budget.active && ' · Inactive'}
              </span>
            </div>
            {budget.description && (
              <p className="mt-0.5 max-w-2xl text-xs text-muted-foreground">{budget.description}</p>
            )}
          </div>

          {canEdit && (
            <div className="flex shrink-0 items-center gap-2">
              {current && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAdjustingPeriod(current)}
                  className="h-8 gap-1.5 text-xs sm:h-9"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Adjust current period
                </Button>
              )}
              <Button size="sm" onClick={() => setIsEditOpen(true)} className="h-8 gap-1.5 text-xs sm:h-9">
                <Pencil className="h-3.5 w-3.5" />
                Edit budget
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Unified Ledger Sheet: Current Period + Defaults */}
      <section className="overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs">
        <div className="divide-y divide-border/60 lg:grid lg:grid-cols-12 lg:divide-x lg:divide-y-0">
          {/* Current Period (8 cols) */}
          <div className="space-y-4 p-4 sm:p-5 lg:col-span-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {current
                    ? `${formatPeriodLabel(current, budget.periodicity, activeTenant.locale)} · ${formatDateRange(current, activeTenant.locale)}`
                    : 'Current period'}
                </span>
              </div>
              {current && <PeriodStatusBadge status={current.status} />}
            </div>

            {current && summary ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <span className="block text-[11px] text-muted-foreground">Remaining</span>
                    <span
                      className={cn(
                        'font-mono text-2xl font-bold tabular-nums tracking-tight sm:text-3xl',
                        summary.remaining < 0 ? 'text-destructive' : 'text-foreground',
                      )}
                    >
                      {money(summary.remaining)}
                    </span>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {Number.isFinite(summary.consumedPercent) ? `${summary.consumedPercent.toFixed(1)}%` : '—'} used
                  </span>
                </div>

                <BudgetProgressBar summary={summary} />

                <dl className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 pt-3">
                  <div className="pr-3">
                    <dt className="text-[11px] text-muted-foreground">Allocated</dt>
                    <dd className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-foreground sm:text-sm">
                      {money(summary.allocated)}
                    </dd>
                  </div>
                  <div className="px-3">
                    <dt className="text-[11px] text-muted-foreground">Spent (paid)</dt>
                    <dd className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-foreground sm:text-sm">
                      {money(summary.spent)}
                    </dd>
                  </div>
                  <div className="pl-3">
                    <dt className="text-[11px] text-muted-foreground">Warns at</dt>
                    <dd className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-foreground sm:text-sm">
                      {money(summary.warningAt)}
                    </dd>
                  </div>
                </dl>

                {(current.warningSent || current.exceededSent) && (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <BellRing className="h-3.5 w-3.5 text-amber-500" />
                    {current.exceededSent
                      ? 'Exceeded alert sent for this period.'
                      : 'Warning alert sent for this period.'}
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border/80 bg-muted/25 p-3.5 text-xs text-muted-foreground">
                <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">No current period yet</p>
                  <p className="mt-0.5">
                    Starts automatically on the first paid expense with{' '}
                    <span className="font-mono font-semibold text-foreground">{money(budget.allocatedAmount)}</span>{' '}
                    allocated.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Defaults & Tracked Categories (4 cols) */}
          <div className="space-y-3.5 p-4 text-xs sm:p-5 lg:col-span-4">
            <h2 className="text-xs font-semibold text-foreground">Defaults</h2>
            <dl className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Default cap</dt>
                <dd className="font-mono font-semibold tabular-nums text-foreground">
                  {money(budget.allocatedAmount)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Warning rule</dt>
                <dd className="font-mono font-medium tabular-nums text-foreground">
                  {formatWarningThreshold(budget.warningType, budget.warningThreshold, money)}
                </dd>
              </div>
            </dl>

            <div className="space-y-2 border-t border-border/60 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground">Categories</span>
                <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {budget.categoryIds.length}
                </span>
              </div>
              <BudgetCategoryChips categoryIds={budget.categoryIds} categoriesById={categories.byId} />
            </div>
          </div>
        </div>
      </section>

      {/* Period History */}
      <Card className="border-border/80 shadow-xs">
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-4 py-3.5 sm:px-5">
          <CardTitle className="text-sm font-semibold">Periods</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void budgetQuery.refetch()
              void periodsQuery.refetch()
            }}
            disabled={budgetQuery.isFetching || periodsQuery.isFetching}
            aria-label="Refresh periods"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw
              className={cn(
                'h-3.5 w-3.5',
                (budgetQuery.isFetching || periodsQuery.isFetching) && 'animate-spin',
              )}
            />
          </Button>
        </CardHeader>
        <CardContent className="border-t border-border/60 p-0">
          {periodsQuery.isLoading ? (
            <div className="space-y-2 p-4 sm:p-5" aria-busy="true">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : periodsQuery.isError ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-xs">
              <p className="text-destructive">{getApiErrorMessage(periodsQuery.error, 'Failed to load periods.')}</p>
              <Button variant="outline" size="sm" onClick={() => void periodsQuery.refetch()} className="text-xs">
                Retry
              </Button>
            </div>
          ) : (
            <PeriodHistoryTable
              periods={periodsQuery.data ?? []}
              periodicity={budget.periodicity}
              currency={activeTenant.currency}
              locale={activeTenant.locale}
              currentPeriodId={current?.id}
              canEdit={canEdit}
              onAdjust={setAdjustingPeriod}
            />
          )}
        </CardContent>
      </Card>

      <BudgetHistorySection budgetId={budget.id} currency={activeTenant.currency} locale={activeTenant.locale} />

      <BudgetFormModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSubmit={handleBudgetSubmit}
        budget={budget}
        categoryOptions={categories.options}
        categoriesLoading={categories.isLoading}
        categoriesError={categories.error}
        onRetryCategories={() => void categories.refetch()}
        currency={activeTenant.currency}
        locale={activeTenant.locale}
      />

      <PeriodEditModal
        period={adjustingPeriod}
        periodLabel={adjustingPeriod ? formatPeriodLabel(adjustingPeriod, budget.periodicity, activeTenant.locale) : ''}
        onClose={() => setAdjustingPeriod(null)}
        onSubmit={handlePeriodSubmit}
        currency={activeTenant.currency}
        locale={activeTenant.locale}
      />
    </div>
  )
}
