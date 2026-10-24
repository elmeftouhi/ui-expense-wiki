import React, { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  BellRing,
  CalendarClock,
  CircleDashed,
  History,
  Pencil,
  RefreshCw,
  SearchX,
  ShieldAlert,
  SlidersHorizontal,
  Tags,
} from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { ApiClientError } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { BudgetCreateRequest, BudgetPeriod, BudgetPeriodUpdateRequest } from '../types'
import { useBudget, useBudgetPeriods, useUpdateBudget, useUpdateBudgetPeriod } from '../hooks/useBudgets'
import { useCategoryOptions } from '../hooks/useCategoryOptions'
import {
  PERIODICITY_LABELS,
  describeWarningRule,
  formatDateRange,
  formatPeriodLabel,
  getBudgetHealth,
  summarizePeriod,
} from '../utils/budgetMath'
import { BudgetHealthBadge, PeriodStatusBadge } from '../components/BudgetStatusBadges'
import { BudgetProgressBar } from '../components/BudgetProgressBar'
import { BudgetCategoryChips } from '../components/BudgetCategoryChips'
import { BudgetFormModal } from '../components/BudgetFormModal'
import { PeriodEditModal } from '../components/PeriodEditModal'
import { PeriodHistoryTable } from '../components/PeriodHistoryTable'
import { BudgetHelpPanel } from '../components/BudgetHelpPanel'

const BackLink: React.FC = () => (
  <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 gap-1.5 text-xs text-muted-foreground">
    <Link to="/budgets">
      <ArrowLeft className="h-3.5 w-3.5" /> All budgets
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
            <SearchX className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-base font-semibold text-foreground">Budget not found</h1>
            <p className="max-w-sm text-xs text-muted-foreground">
              It may have been removed or belongs to a different workspace than <strong>{activeTenant.name}</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (budgetQuery.isLoading) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading budget">
        <BackLink />
        <div className="h-8 w-64 animate-pulse rounded-lg bg-muted" />
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="h-56 animate-pulse rounded-xl bg-muted lg:col-span-2" />
          <div className="h-56 animate-pulse rounded-xl bg-muted" />
        </div>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (budgetQuery.isError || !budgetQuery.data) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            <h1 className="text-sm font-semibold text-foreground">Couldn't load this budget</h1>
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
      toast.success('Period updated', `${formatPeriodLabel(updated, budget.periodicity, activeTenant.locale)} now has ${money(updated.allocatedAmount)} allocated.`)
    } catch (err) {
      toast.error('Could not update period', getApiErrorMessage(err))
      throw err
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2 border-b border-border/40 pb-3">
        <BackLink />
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{budget.name}</h1>
              <BudgetHealthBadge health={health} />
              <Badge variant="outline" className="text-[10px]">{PERIODICITY_LABELS[budget.periodicity]}</Badge>
              <Badge variant={budget.active ? 'success' : 'secondary'} className="text-[10px]">
                {budget.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            {budget.description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{budget.description}</p>}
          </div>
          {canEdit && (
            <div className="flex shrink-0 items-center gap-2">
              {current && (
                <Button variant="outline" size="sm" onClick={() => setAdjustingPeriod(current)} className="h-9 gap-1.5 text-xs">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Adjust current period
                </Button>
              )}
              <Button size="sm" onClick={() => setIsEditOpen(true)} className="h-9 gap-1.5 text-xs">
                <Pencil className="h-3.5 w-3.5" /> Edit budget
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Current period */}
        <Card className="relative overflow-hidden lg:col-span-2">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarClock className="h-4 w-4 text-primary" /> Current period
              </CardTitle>
              {current && <PeriodStatusBadge status={current.status} />}
            </div>
            {current && (
              <CardDescription className="text-xs">
                {formatPeriodLabel(current, budget.periodicity, activeTenant.locale)} · {formatDateRange(current, activeTenant.locale)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-5 px-5 pb-5">
            {current && summary ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Remaining</p>
                    <p className={cn('font-mono text-3xl font-bold tabular-nums tracking-tight', summary.remaining < 0 ? 'text-destructive' : 'text-foreground')}>
                      {money(summary.remaining)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Number.isFinite(summary.consumedPercent) ? `${summary.consumedPercent.toFixed(1)}%` : '—'} used
                  </p>
                </div>
                <BudgetProgressBar summary={summary} />
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[
                    ['Allocated', money(summary.allocated)],
                    ['Spent', money(summary.spent)],
                    ['Warns at', money(summary.warningAt)],
                    ['Last updated', formatDate(current.updatedAt ?? current.createdAt, { locale: activeTenant.locale })],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-border/60 bg-background/60 p-3">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{value}</dd>
                    </div>
                  ))}
                </dl>
                {(current.warningSent || current.exceededSent) && (
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <BellRing className="h-3.5 w-3.5 text-amber-500" />
                    {current.exceededSent ? 'Exceeded notification sent for this period.' : 'Warning notification sent for this period.'}
                  </p>
                )}
              </>
            ) : (
              <div className="flex items-start gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4">
                <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="font-semibold text-foreground">No current period instance yet</p>
                  <p>
                    The current {PERIODICITY_LABELS[budget.periodicity].toLowerCase()} period will be created automatically when the
                    first expense in one of the tracked categories is recorded. It will start with{' '}
                    <span className="font-mono font-semibold text-foreground">{money(budget.allocatedAmount)}</span> allocated.
                  </p>
                  <p>Expenses recorded before the period exists are not linked retroactively.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuration */}
        <Card>
          <CardHeader className="p-5 pb-3">
            <CardTitle className="text-sm">Budget defaults</CardTitle>
            <CardDescription className="text-xs">Applied to each new period instance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-5 pb-5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Allocation per period</span>
              <span className="font-mono font-semibold text-foreground">{money(budget.allocatedAmount)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Warning</span>
              <span className="text-right font-medium text-foreground">
                {describeWarningRule(budget.warningType, budget.warningThreshold, money)}
              </span>
            </div>
            <div className="space-y-2 border-t border-border/50 pt-3">
              <p className="flex items-center gap-1.5 font-semibold text-foreground">
                <Tags className="h-3.5 w-3.5 text-primary" /> Tracked categories ({budget.categoryIds.length})
              </p>
              <BudgetCategoryChips categoryIds={budget.categoryIds} categoriesById={categories.byId} />
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                These categories may also belong to other budgets — matching expenses are deducted from each.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Period history */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-5 pb-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <History className="h-4 w-4 text-primary" /> Period history
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Spend is recalculated automatically when expenses are updated or deleted.
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void budgetQuery.refetch()
              void periodsQuery.refetch()
            }}
            disabled={budgetQuery.isFetching || periodsQuery.isFetching}
            aria-label="Refresh periods"
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', (budgetQuery.isFetching || periodsQuery.isFetching) && 'animate-spin')} />
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {periodsQuery.isLoading ? (
            <div className="space-y-2 p-5" aria-busy="true">
              {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />)}
            </div>
          ) : periodsQuery.isError ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-xs">
              <p className="text-destructive">{getApiErrorMessage(periodsQuery.error, 'Failed to load periods.')}</p>
              <Button variant="outline" size="sm" onClick={() => void periodsQuery.refetch()} className="text-xs">Retry</Button>
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

      <BudgetHelpPanel />

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
