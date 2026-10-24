import React, { useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  LayoutGrid,
  List,
  PiggyBank,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Wallet,
} from 'lucide-react'
import { useActiveTenant } from '@/features/tenants'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import type { Budget, BudgetCreateRequest, BudgetHealth } from '../types'
import { useBudgets, useCreateBudget, useUpdateBudget } from '../hooks/useBudgets'
import { useCategoryOptions } from '../hooks/useCategoryOptions'
import { getBudgetHealth, summarizePortfolio } from '../utils/budgetMath'
import { BudgetCard } from '../components/BudgetCard'
import { BudgetsTable } from '../components/BudgetsTable'
import { BudgetFormModal } from '../components/BudgetFormModal'
import { BudgetHelpPanel } from '../components/BudgetHelpPanel'
import { BudgetProgressBar } from '../components/BudgetProgressBar'

type HealthFilter = 'ALL' | BudgetHealth
type ViewMode = 'cards' | 'table'

const FILTERS: { value: HealthFilter; label: string; icon?: React.ComponentType<{ className?: string }>; iconClass?: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ON_TRACK', label: 'On track', icon: CheckCircle2, iconClass: 'text-emerald-500' },
  { value: 'WARNING', label: 'Near limit', icon: AlertTriangle, iconClass: 'text-amber-500' },
  { value: 'EXCEEDED', label: 'Exceeded', icon: ShieldAlert, iconClass: 'text-destructive' },
  { value: 'NO_PERIOD', label: 'No activity', icon: CircleDashed, iconClass: 'text-muted-foreground' },
]

const BudgetCardSkeleton: React.FC = () => (
  <Card className="animate-pulse space-y-4 p-5">
    <div className="h-4 w-2/3 rounded bg-muted" />
    <div className="flex gap-1.5">
      <div className="h-4 w-16 rounded bg-muted" />
      <div className="h-4 w-20 rounded bg-muted" />
    </div>
    <div className="h-2.5 w-full rounded-full bg-muted" />
    <div className="grid grid-cols-3 gap-2">
      <div className="h-8 rounded bg-muted" />
      <div className="h-8 rounded bg-muted" />
      <div className="h-8 rounded bg-muted" />
    </div>
  </Card>
)

export const BudgetsPage: React.FC = () => {
  const { activeTenant } = useActiveTenant()
  return <BudgetsPageContent key={activeTenant.id} />
}

const BudgetsPageContent: React.FC = () => {
  const { activeTenant, canEdit } = useActiveTenant()
  const toast = useToast()
  const { data: budgets = [], isLoading, isError, error, refetch, isFetching } = useBudgets()
  const categories = useCategoryOptions()
  const createMutation = useCreateBudget()
  const updateMutation = useUpdateBudget()

  const [filter, setFilter] = useState<HealthFilter>('ALL')
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)

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
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
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
      throw err // keep the modal open with the inline error
    }
  }

  const attentionCount = portfolio.counts.WARNING + portfolio.counts.EXCEEDED
  const portfolioHealth = portfolio.totalSpent > portfolio.totalAllocated ? 'EXCEEDED' : portfolio.consumedPercent >= 80 ? 'WARNING' : 'ON_TRACK'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-2 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2.5 text-2xl font-bold tracking-tight text-foreground">
              <PiggyBank className="h-6 w-6 text-primary" />
              Budgets
            </h1>
            <Badge variant="outline" className="text-xs font-medium">{activeTenant.name}</Badge>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Spending caps per category, tracked automatically from your expenses.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="Refresh budgets"
            className="h-9 w-9 p-0"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
          </Button>
          {canEdit && (
            <Button size="sm" onClick={openCreate} className="h-9 gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              New budget
            </Button>
          )}
        </div>
      </div>

      <BudgetHelpPanel />

      {/* KPIs (current periods only) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-xs">
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Allocated</span>
              <div className="rounded-xl bg-primary/10 p-2 text-primary"><Wallet className="h-4 w-4" /></div>
            </div>
            <div className="font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground">{money(portfolio.totalAllocated)}</div>
            <p className="text-[11px] text-muted-foreground">
              Current periods of {portfolio.trackedBudgets} of {portfolio.totalBudgets} budgets
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Spent</span>
              <Badge variant={portfolioHealth === 'EXCEEDED' ? 'destructive' : portfolioHealth === 'WARNING' ? 'warning' : 'success'} className="font-mono text-[11px]">
                {portfolio.consumedPercent.toFixed(1)}%
              </Badge>
            </div>
            <div className="font-mono text-2xl font-bold tabular-nums tracking-tight text-foreground">{money(portfolio.totalSpent)}</div>
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
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Remaining</span>
              <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /></div>
            </div>
            <div className={cn('font-mono text-2xl font-bold tabular-nums tracking-tight', portfolio.totalRemaining < 0 ? 'text-destructive' : 'text-foreground')}>
              {money(portfolio.totalRemaining)}
            </div>
            <p className="text-[11px] text-muted-foreground">Across current periods; shared categories count in each budget.</p>
          </CardContent>
        </Card>
        <Card className="shadow-xs">
          <CardContent className="space-y-2 p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Needs attention</span>
              <div className={cn('rounded-xl p-2', attentionCount > 0 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground')}>
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="text-2xl font-bold tracking-tight text-foreground">{attentionCount}</div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="warning" className="text-[10px]">{portfolio.counts.WARNING} near limit</Badge>
              <Badge variant={portfolio.counts.EXCEEDED > 0 ? 'destructive' : 'outline'} className="text-[10px]">{portfolio.counts.EXCEEDED} exceeded</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col items-stretch justify-between gap-3 lg:flex-row lg:items-center">
        <div role="tablist" aria-label="Filter budgets by health" className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border/60 bg-muted/60 p-1 text-xs">
          {FILTERS.map(({ value, label, icon: Icon, iconClass }) => {
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
                  'flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 font-medium transition-all',
                  active ? 'bg-background font-semibold text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {Icon && <Icon className={cn('h-3 w-3', iconClass)} />}
                {label} ({count})
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-full lg:w-64">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search budgets or categories…"
              aria-label="Search budgets"
              className="h-9 w-full rounded-xl border border-input bg-background pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex rounded-xl border border-border/60 bg-muted/60 p-1" role="group" aria-label="View mode">
            {([['cards', LayoutGrid], ['table', List]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={viewMode === mode}
                aria-label={mode === 'cards' ? 'Card view' : 'Table view'}
                onClick={() => setViewMode(mode)}
                className={cn(
                  'cursor-pointer rounded-lg p-1.5 transition-all',
                  viewMode === mode ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading budgets">
          {Array.from({ length: 6 }, (_, i) => <BudgetCardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-destructive" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Couldn't load budgets</h2>
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
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <PiggyBank className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">No budgets yet</h2>
              <p className="mx-auto mt-0.5 max-w-sm text-xs text-muted-foreground">
                Create a budget, pick the categories it covers, and spend will be deducted automatically as expenses come in.
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
          <CardContent className="space-y-3 py-12 text-center">
            <h2 className="text-sm font-semibold text-foreground">No budgets match your filters</h2>
            <Button variant="outline" size="sm" onClick={() => { setFilter('ALL'); setSearch('') }} className="text-xs">
              Reset filters
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
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
