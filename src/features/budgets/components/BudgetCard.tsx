import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Budget } from '../types'
import { PERIODICITY_LABELS, formatPeriodLabel, getBudgetHealth, summarizePeriod } from '../utils/budgetMath'
import type { CategoryOption } from '../utils/categoryOptions'
import { BudgetHealthBadge } from './BudgetStatusBadges'
import { BudgetProgressBar } from './BudgetProgressBar'
import { BudgetCategoryChips } from './BudgetCategoryChips'

interface BudgetCardProps {
  budget: Budget
  categoriesById: Map<number, CategoryOption>
  currency: string
  locale?: string
  canEdit: boolean
  onEdit: (budget: Budget) => void
}

const BORDER_BY_HEALTH = {
  ON_TRACK: 'border-border/80 hover:border-border',
  WARNING: 'border-amber-500/35 hover:border-amber-500/55',
  EXCEEDED: 'border-destructive/35 hover:border-destructive/55',
  NO_PERIOD: 'border-border/70 hover:border-border',
} as const

export const BudgetCard: React.FC<BudgetCardProps> = ({
  budget,
  categoriesById,
  currency,
  locale,
  canEdit,
  onEdit,
}) => {
  const navigate = useNavigate()
  const money = (n: number) => formatCurrency(n, { currency, locale })
  const health = getBudgetHealth(budget)
  const period = budget.currentPeriod
  const summary = period ? summarizePeriod(period) : null

  const handleCardClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    if (target.closest('a, button')) return
    navigate(`/budgets/${budget.id}`)
  }

  return (
    <article
      data-testid={`budget-card-${budget.id}`}
      onClick={handleCardClick}
      className={cn(
        'group flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xs transition-colors',
        BORDER_BY_HEALTH[health],
        !budget.active && 'opacity-65',
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-4 pb-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/budgets/${budget.id}`}
            className="block truncate text-sm font-semibold text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
          >
            {budget.name}
          </Link>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {PERIODICITY_LABELS[budget.periodicity]}
            {period && ` · ${formatPeriodLabel(period, budget.periodicity, locale)}`}
            {!budget.active && ' · Inactive'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <BudgetHealthBadge health={health} />
          {canEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                onEdit(budget)
              }}
              aria-label={`Edit ${budget.name}`}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground sm:h-7 sm:w-7"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Spending & Progress */}
      <div className="space-y-2 px-4 pb-3.5">
        {period && summary ? (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
              <div className="flex items-baseline gap-1.5">
                <span
                  className={cn(
                    'font-mono text-lg font-bold tabular-nums tracking-tight',
                    summary.remaining < 0 ? 'text-destructive' : 'text-foreground',
                  )}
                >
                  {summary.remaining < 0 ? money(Math.abs(summary.remaining)) : money(summary.remaining)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {summary.remaining < 0 ? 'over' : 'left'}
                </span>
              </div>

              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">{money(summary.spent)}</span>
                {' / '}
                {money(summary.allocated)}
              </span>
            </div>

            <BudgetProgressBar summary={summary} size="sm" />
          </>
        ) : (
          <div className="flex items-baseline justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">No current period yet</span>
            <span className="font-mono font-semibold tabular-nums text-foreground">
              {money(budget.allocatedAmount)}
            </span>
          </div>
        )}
      </div>

      {/* Categories */}
      <div className="mt-auto border-t border-border/50 px-4 py-2.5">
        <BudgetCategoryChips categoryIds={budget.categoryIds} categoriesById={categoriesById} max={3} />
      </div>
    </article>
  )
}
