import React from 'react'
import { Link } from 'react-router-dom'
import { Pencil } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import type { Budget } from '../types'
import { PERIODICITY_LABELS, formatPeriodLabel, getBudgetHealth, summarizePeriod } from '../utils/budgetMath'
import type { CategoryOption } from '../utils/categoryOptions'
import { BudgetHealthBadge, PeriodStatusBadge } from './BudgetStatusBadges'
import { BudgetProgressBar } from './BudgetProgressBar'
import { BudgetCategoryChips } from './BudgetCategoryChips'

interface BudgetsTableProps {
  budgets: Budget[]
  categoriesById: Map<number, CategoryOption>
  currency: string
  locale?: string
  canEdit: boolean
  onEdit: (budget: Budget) => void
}

export const BudgetsTable: React.FC<BudgetsTableProps> = ({ budgets, categoriesById, currency, locale, canEdit, onEdit }) => {
  const money = (n: number) => formatCurrency(n, { currency, locale })

  return (
    <Card className="overflow-hidden">
      <div className="custom-scrollbar overflow-x-auto">
        <table className="w-full min-w-[880px] text-xs">
          <thead className="bg-muted/40">
            <tr className="text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="px-4 py-2.5">Budget</th>
              <th scope="col" className="px-4 py-2.5">Current period</th>
              <th scope="col" className="px-4 py-2.5 text-right">Allocated</th>
              <th scope="col" className="px-4 py-2.5 text-right">Spent</th>
              <th scope="col" className="px-4 py-2.5 text-right">Remaining</th>
              <th scope="col" className="w-36 px-4 py-2.5">Usage</th>
              <th scope="col" className="px-4 py-2.5">Health</th>
              {canEdit && <th scope="col" className="px-4 py-2.5"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody>
            {budgets.map((budget) => {
              const period = budget.currentPeriod
              const s = period ? summarizePeriod(period) : null
              return (
                <tr key={budget.id} className={cn('border-t border-border/50 transition-colors hover:bg-muted/30', !budget.active && 'opacity-70')}>
                  <td className="max-w-64 px-4 py-3">
                    <Link to={`/budgets/${budget.id}`} className="font-semibold text-foreground hover:text-primary">
                      {budget.name}
                    </Link>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {PERIODICITY_LABELS[budget.periodicity]}
                      {!budget.active && ' · Inactive'}
                    </div>
                    <BudgetCategoryChips categoryIds={budget.categoryIds} categoriesById={categoriesById} max={2} className="mt-1.5" />
                  </td>
                  <td className="px-4 py-3">
                    {period ? (
                      <div className="flex flex-col items-start gap-1">
                        <span className="font-medium text-foreground">{formatPeriodLabel(period, budget.periodicity, locale)}</span>
                        <PeriodStatusBadge status={period.status} />
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Not started</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{money(s ? s.allocated : budget.allocatedAmount)}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{s ? money(s.spent) : '—'}</td>
                  <td className={cn('px-4 py-3 text-right font-mono font-semibold tabular-nums', s && s.remaining < 0 && 'text-destructive')}>
                    {s ? money(s.remaining) : '—'}
                  </td>
                  <td className="px-4 py-3">{s ? <BudgetProgressBar summary={s} size="sm" /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3"><BudgetHealthBadge health={getBudgetHealth(budget)} /></td>
                  {canEdit && (
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" size="sm" onClick={() => onEdit(budget)} aria-label={`Edit ${budget.name}`} className="h-7 w-7 p-0">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
