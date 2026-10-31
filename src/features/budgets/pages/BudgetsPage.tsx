import React, { useMemo, useState } from 'react'
import {
  LayoutGrid,
  List,
  PiggyBank,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import type { Budget, BudgetCreateRequest, BudgetHealth } from '../types'
import { useBudgets, useCreateBudget, useUpdateBudget } from '../hooks/useBudgets'
import { useCategoryOptions } from '../hooks/useCategoryOptions'
import { getBudgetHealth, summarizePeriod, summarizePortfolio } from '../utils/budgetMath'
import { BudgetCard } from '../components/BudgetCard'
import { BudgetsTable } from '../components/BudgetsTable'
import { BudgetFormModal } from '../components/BudgetFormModal'
import { BudgetProgressBar } from '../components/BudgetProgressBar'

type HealthFilter = 'ALL' | BudgetHealth
type ViewMode = 'cards' | 'table'

const FILTERS: { value: HealthFilter; label: string; dotClass?: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ON_TRACK', label: 'On track', dotClass: 'bg-emerald-500' },
  { value: 'WARNING', label: 'Near limit', dotClass: 'bg-amber-500' },
  { value: 'EXCEEDED', label: 'Exceeded', dotClass: 'bg-destructive' },
  { value: 'NO_PERIOD', label: 'No activity', dotClass: 'bg-muted-foreground/50' },
]

const HEALTH_SORT_ORDER: Record<BudgetHealth, number> = {
  EXCEEDED: 0,
  WARNING: 1,
  ON_TRACK: 2,
  NO_PERIOD: 3,
}

const BudgetCardSkeleton: React.FC = () => (
  <div className="animate-pulse space-y-3 rounded-xl border border-border/70 bg-card p-4">
    <div className="flex items-start justify-between gap-2">
      <div className="space-y-1.5 flex-1">
        <div className="h-4 w-1/2 rounded bg-muted" />
        <div className="h-3 w-1/3 rounded bg-muted/70" />
      </div>
      <div className="h-5 w-16 rounded-full bg-muted" />
    </div>
    <div className="space-y-2 pt-1">
      <div className="h-6 w-28 rounded bg-muted" />
      <div className="h-1.5 w-full rounded-full bg-muted" />
    </div>
    <div className="flex gap-1.5 border-t border-border/50 pt-2.5">
      <div className="h-5 w-16 rounded bg-muted/70" />
      <div className="h-5 w-20 rounded bg-muted/70" />
    </div>
  </div>
)

export const BudgetsPage: React.FC = () => {
  const { activeTenant } = useActiveTenant()
  return <BudgetsPageContent key={activeTenant.id} />
}

const BudgetsPageContent: React.FC = () => {
  const { activeTenant, canEdit } = useActiveTenant()
  const toast = useToast()
  const isDesktop = useMediaQuery('(min-width: 768px)', true)
  const { data: budgets = [], isLoading, isError, error, refetch } = useBudgets()
  const categories = useCategoryOptions()
  const createMutation = useCreateBudget()
  const updateMutation = useUpdateBudget()

  const [filter, setFilter] = useState<HealthFilter>('ALL')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)

  const effectiveViewMode: ViewMode = isDesktop ? viewMode : 'cards'
  const money = (n: number) => formatCurrency(n, { currency: activeTenant.currency, locale: activeTenant.locale })
  const portfolio = useMemo(() => summarizePortfolio(budgets), [budgets])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return budgets
      .filter((b) => filter === 'ALL' || getBudgetHealth(b) === filter)
      .filter((b) => {
        if (!q) return true
        const categoryNames = b.categoryIds.map((id) => categories.byId.get(id)?.name ?? '').join(' ')
        return `${b.name} ${b.description ?? ''} ${categoryNames}`.toLowerCase().includes(q)
      })
      .sort((a, b) => {
        const activeDiff = Number(b.active) - Number(a.active)
        if (activeDiff !== 0) return activeDiff
        const healthDiff = HEALTH_SORT_ORDER[getBudgetHealth(a)] - HEALTH_SORT_ORDER[getBudgetHealth(b)]
        if (healthDiff !== 0) return healthDiff
        const pctA = a.currentPeriod ? summarizePeriod(a.currentPeriod).consumedPercent : -1
        const pctB = b.currentPeriod ? summarizePeriod(b.currentPeriod).consumedPercent : -1
        if (pctB !== pctA) return pctB - pctA
        return a.name.localeCompare(b.name)
      })
  }, [budgets, filter, search, categories.byId])

  const openCreate = () => {
    setEditingBudget(null)
    setIsFormOpen(true)
  }
  const openEdit = (budget: Budget) => {
    setEditingBudget(budget)
    setIsFormOpen(true)
  }

  const handleSubmit = async (payload: BudgetCreateRequest) => {
    try {
      if (editingBudget) {
        await updateMutation.mutateAsync({ id: editingBudget.id, payload })
        toast.success('Budget updated', `“${payload.name}” has been saved.`)
      } else {
        await createMutation.mutateAsync(payload)
        toast.success(
          'Budget created',
          `“${payload.name}” will start tracking with the next matching expense.`,
        )
      }
    } catch (err) {
      toast.error(editingBudget ? 'Could not update budget' : 'Could not create budget', getApiErrorMessage(err))
      throw err
    }
  }

  const portfolioHealth =
    portfolio.totalSpent > portfolio.totalAllocated
      ? 'EXCEEDED'
      : portfolio.consumedPercent >= 80
      ? 'WARNING'
      : 'ON_TRACK'

  const showToolbar = !isError && (isLoading || budgets.length > 0)

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Compact Single-Row Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Budgets
        </h1>
        {canEdit && (
          <Button size="sm" onClick={openCreate} className="h-8 shrink-0 gap-1.5 text-xs sm:h-9">
            <Plus className="h-3.5 w-3.5" />
            New budget
          </Button>
        )}
      </div>

      {/* Unified Overview Strip (Current Periods) */}
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-xl border border-border/70 bg-card" />
      ) : !isError && budgets.length > 0 ? (
        <section
          aria-label="Budgets overview"
          className="overflow-hidden rounded-xl border border-border/80 bg-card text-card-foreground shadow-xs"
        >
          <div className="space-y-3.5 p-4 sm:p-5 md:grid md:grid-cols-12 md:items-center md:gap-6 md:space-y-0">
            {/* Primary Balance & Gauge */}
            <div className="space-y-2 md:col-span-7">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {portfolio.totalRemaining < 0 ? 'Over budget this period' : 'Remaining this period'}
                </span>
                {portfolio.trackedBudgets > 0 && (
                  <Badge
                    variant={
                      portfolioHealth === 'EXCEEDED'
                        ? 'destructive'
                        : portfolioHealth === 'WARNING'
                        ? 'warning'
                        : 'outline'
                    }
                    className="px-2 py-0 font-mono text-[11px] tabular-nums"
                  >
                    {portfolio.consumedPercent.toFixed(0)}% used
                  </Badge>
                )}
              </div>

              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div
                  className={cn(
                    'font-mono text-2xl font-bold tabular-nums tracking-tight sm:text-3xl',
                    portfolio.totalRemaining < 0 ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {portfolio.totalRemaining < 0
                    ? money(Math.abs(portfolio.totalRemaining))
                    : money(portfolio.totalRemaining)}
                </div>

                <div className="font-mono text-xs tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{money(portfolio.totalSpent)}</span>
                  {' spent of '}
                  <span className="font-medium text-foreground">{money(portfolio.totalAllocated)}</span>
                </div>
              </div>

              <BudgetProgressBar
                size="sm"
                summary={{
                  allocated: portfolio.totalAllocated,
                  spent: portfolio.totalSpent,
                  remaining: portfolio.totalRemaining,
                  consumedPercent: portfolio.consumedPercent,
                  warningAt: portfolio.totalAllocated * 0.8,
                  health: portfolioHealth,
                }}
              />
            </div>

            {/* Compact Status Breakdown */}
            <div className="grid grid-cols-3 divide-x divide-border/60 border-t border-border/60 pt-3 md:col-span-5 md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <div className="pr-3">
                <span className="block text-[11px] text-muted-foreground">Active</span>
                <span className="mt-0.5 block font-mono text-sm font-semibold tabular-nums text-foreground sm:text-base">
                  {portfolio.activeBudgets}
                  <span className="text-xs font-normal text-muted-foreground">/{portfolio.totalBudgets}</span>
                </span>
              </div>

              <button
                type="button"
                onClick={() => setFilter((prev) => (prev === 'WARNING' ? 'ALL' : 'WARNING'))}
                className={cn(
                  'cursor-pointer px-3 text-left transition-opacity hover:opacity-80',
                  filter === 'WARNING' && 'underline decoration-amber-500 underline-offset-4',
                )}
              >
                <span className="block text-[11px] text-muted-foreground">Near limit</span>
                <span
                  className={cn(
                    'mt-0.5 block font-mono text-sm font-semibold tabular-nums sm:text-base',
                    portfolio.counts.WARNING > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-muted-foreground',
                  )}
                >
                  {portfolio.counts.WARNING}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilter((prev) => (prev === 'EXCEEDED' ? 'ALL' : 'EXCEEDED'))}
                className={cn(
                  'cursor-pointer pl-3 text-left transition-opacity hover:opacity-80',
                  filter === 'EXCEEDED' && 'underline decoration-destructive underline-offset-4',
                )}
              >
                <span className="block text-[11px] text-muted-foreground">Exceeded</span>
                <span
                  className={cn(
                    'mt-0.5 block font-mono text-sm font-semibold tabular-nums sm:text-base',
                    portfolio.counts.EXCEEDED > 0 ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {portfolio.counts.EXCEEDED}
                </span>
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {/* Filter & Search Toolbar */}
      {showToolbar && (
        <div className="flex flex-col items-stretch justify-between gap-2.5 lg:flex-row lg:items-center">
          <div
            role="tablist"
            aria-label="Filter budgets by health"
            className="no-scrollbar flex items-center gap-0.5 overflow-x-auto rounded-lg border border-border/60 bg-muted/50 p-1 text-xs"
          >
            {FILTERS.map(({ value, label, dotClass }) => {
              const count = value === 'ALL' ? budgets.length : portfolio.counts[value]
              const active = filter === value
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(value)}
                  className={cn(
                    'flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 font-medium transition-colors',
                    active
                      ? 'bg-background font-semibold text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {dotClass && <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', dotClass)} />}
                  <span>{label}</span>
                  <span className="font-mono text-[11px] tabular-nums opacity-70">{count}</span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 lg:w-64 lg:flex-none">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search budgets or categories…"
                aria-label="Search budgets"
                className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-8 text-xs focus:outline-none focus:ring-1 focus:ring-ring [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {isDesktop && (
              <div
                className="flex rounded-lg border border-border/60 bg-muted/50 p-1"
                role="group"
                aria-label="View mode"
              >
                {([
                  ['cards', LayoutGrid],
                  ['table', List],
                ] as const).map(([mode, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={viewMode === mode}
                    aria-label={mode === 'cards' ? 'Card view' : 'Table view'}
                    onClick={() => setViewMode(mode)}
                    className={cn(
                      'cursor-pointer rounded-md p-1.5 transition-colors',
                      viewMode === mode
                        ? 'bg-background text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div
          className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Loading budgets"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <BudgetCardSkeleton key={i} />
          ))}
        </div>
      ) : isError ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-7 w-7 text-destructive" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Couldn&apos;t load budgets</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">{getApiErrorMessage(error)}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void refetch()} className="gap-1.5 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Try again
            </Button>
          </CardContent>
        </Card>
      ) : budgets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <PiggyBank className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">No budgets yet</h2>
              <p className="mx-auto mt-0.5 max-w-xs text-xs text-muted-foreground">
                Set spending caps per category to track consumption automatically.
              </p>
            </div>
            {canEdit && (
              <Button size="sm" onClick={openCreate} className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" /> Create your first budget
              </Button>
            )}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="space-y-3 py-10 text-center">
            <h2 className="text-sm font-semibold text-foreground">No budgets match your filters</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setFilter('ALL')
                setSearch('')
              }}
              className="text-xs"
            >
              Reset filters
            </Button>
          </CardContent>
        </Card>
      ) : effectiveViewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <BudgetCard
              key={b.id}
              budget={b}
              categoriesById={categories.byId}
              currency={activeTenant.currency}
              locale={activeTenant.locale}
              canEdit={canEdit}
              onEdit={openEdit}
            />
          ))}
        </div>
      ) : (
        <BudgetsTable
          budgets={filtered}
          categoriesById={categories.byId}
          currency={activeTenant.currency}
          locale={activeTenant.locale}
          canEdit={canEdit}
          onEdit={openEdit}
        />
      )}

      <BudgetFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingBudget(null)
        }}
        onSubmit={handleSubmit}
        budget={editingBudget}
        categoryOptions={categories.options}
        categoriesLoading={categories.isLoading}
        categoriesError={categories.error}
        onRetryCategories={() => void categories.refetch()}
        currency={activeTenant.currency}
        locale={activeTenant.locale}
      />
    </div>
  )
}
