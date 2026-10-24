import React from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CircleDashed, Pencil } from 'lucide-react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Budget } from '../types'
import { PERIODICITY_LABELS, formatPeriodLabel, getBudgetHealth, summarizePeriod } from '../utils/budgetMath'
import type { CategoryOption } from '../utils/categoryOptions'
import { BudgetHealthBadge, PeriodStatusBadge } from './BudgetStatusBadges'
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

const ACCENT_BY_HEALTH = {
  ON_TRACK: 'before:bg-emerald-500',
  WARNING: 'before:bg-amber-500',
  EXCEEDED: 'before:bg-destructive',
  NO_PERIOD: 'before:bg-border',
} as const

export const BudgetCard: React.FC<BudgetCardProps> = ({ budget, categoriesById, currency, locale, canEdit, onEdit }) => {
  const money = (n: number) => formatCurrency(n, { currency, locale })
  const health = getBudgetHealth(budget)
  const period = budget.currentPeriod
  const summary = period ? summarizePeriod(period) : null

  return (
    <Card
      data-testid={`budget-card-${budget.id}`}
      className={cn(
        'group relative flex flex-col overflow-hidden before:absolute before:inset-x-0 before:top-0 before:h-1 hover:-translate-y-0.5 hover:shadow-md',
        ACCENT_BY_HEALTH[health],
        !budget.active && 'opacity-75',
      )}
    >
      <CardHeader className="space-y-2 p-5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link
              to={`/budgets/${budget.id}`}
              className="block truncate text-sm font-bold text-foreground hover:text-primary focus:outline-none focus-visible:underline"
            >
              {budget.name}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className="text-[10px]">{PERIODICITY_LABELS[budget.periodicity]}</Badge>
              {!budget.active && <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
            </div>
          </div>
          <BudgetHealthBadge health={health} />
        </div>
        <BudgetCategoryChips categoryIds={budget.categoryIds} categoriesById={categoriesById} max={3} />
      </CardHeader>

      <CardContent className="flex-1 space-y-3 px-5 pb-4">
        {period && summary ? (
          <>
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-foreground">{formatPeriodLabel(period, budget.periodicity, locale)}</span>
              <PeriodStatusBadge status={period.status} />
            </div>
            <BudgetProgressBar summary={summary} />
            <dl className="grid grid-cols-3 gap-2 text-[11px]">
              <div>
                <dt className="text-muted-foreground">Allocated</dt>
                <dd className="font-mono font-semibold tabular-nums text-foreground">{money(summary.allocated)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Spent</dt>
                <dd className="font-mono font-semibold tabular-nums text-foreground">{money(summary.spent)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Remaining</dt>
                <dd className={cn('font-mono font-semibold tabular-nums', summary.remaining < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>
                  {money(summary.remaining)}
                </dd>
              </div>
            </dl>
          </>
        ) : (
          <div className="flex items-start gap-2.5 rounded-lg border border-dashed border-border/80 bg-muted/30 p-3">
            <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-[11px] leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">No current period yet</p>
              It starts automatically with the first matching expense. Default allocation:{' '}
              <span className="font-mono font-semibold text-foreground">{money(budget.allocatedAmount)}</span>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="justify-between gap-2 border-t border-border/50 px-5 py-3">
        <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px]">
          <Link to={`/budgets/${budget.id}`}>
            View details
            <ArrowUpRight className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        </Button>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onEdit(budget)}
            aria-label={`Edit ${budget.name}`}
            className="h-7 gap-1 px-2 text-[11px]"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}
