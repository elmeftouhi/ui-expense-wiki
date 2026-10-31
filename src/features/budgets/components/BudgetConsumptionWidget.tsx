import { Link } from 'react-router-dom'
import { ArrowRight, PiggyBank } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { useBudgets } from '../hooks/useBudgets'
import { getBudgetHealth, summarizePeriod } from '../utils/budgetMath'
import type { BudgetHealth } from '../types'
import { BudgetHealthBadge } from './BudgetStatusBadges'
import { BudgetProgressBar } from './BudgetProgressBar'

interface BudgetConsumptionWidgetProps {
  currency: string
  locale: string
}

const HEALTH_PRIORITY: Record<BudgetHealth, number> = {
  EXCEEDED: 0,
  WARNING: 1,
  ON_TRACK: 2,
  NO_PERIOD: 3,
}

const VISIBLE_BUDGET_LIMIT = 3

export function BudgetConsumptionWidget({ currency, locale }: BudgetConsumptionWidgetProps) {
  const { data: budgets = [], isLoading, isError, error, refetch } = useBudgets()
  const activeBudgets = budgets
    .filter((budget) => budget.active)
    .sort((a, b) => {
      const priorityDiff = HEALTH_PRIORITY[getBudgetHealth(a)] - HEALTH_PRIORITY[getBudgetHealth(b)]
      if (priorityDiff !== 0) return priorityDiff
      const pctA = a.currentPeriod ? summarizePeriod(a.currentPeriod).consumedPercent : -1
      const pctB = b.currentPeriod ? summarizePeriod(b.currentPeriod).consumedPercent : -1
      return pctB - pctA
    })

  const visibleBudgets = activeBudgets.slice(0, VISIBLE_BUDGET_LIMIT)
  const hiddenCount = Math.max(0, activeBudgets.length - VISIBLE_BUDGET_LIMIT)
  const money = (amount: number) => formatCurrency(amount, { currency, locale })

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="pb-2.5 pt-4 px-4 sm:px-5">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base font-semibold">
            <PiggyBank className="h-4 w-4 text-primary shrink-0" />
            <span>Active budgets</span>
          </CardTitle>
          <Link
            to="/budgets"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>All budgets</span>
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pt-1 pb-4 px-4 sm:px-5 text-xs">
        {isLoading ? (
          <p role="status" className="text-muted-foreground py-2">Loading budgets...</p>
        ) : isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-destructive">{getApiErrorMessage(error, 'Could not load budgets.')}</p>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void refetch()}>
              Retry budgets
            </Button>
          </div>
        ) : activeBudgets.length === 0 ? (
          <div className="flex items-center justify-between gap-3 py-1">
            <p className="text-muted-foreground">No active budgets yet.</p>
            <Button asChild variant="outline" size="sm" className="h-7 text-xs shrink-0">
              <Link to="/budgets">Create budget</Link>
            </Button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border/40">
              {visibleBudgets.map((budget) => (
                <li key={budget.id} className="space-y-1.5 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/budgets/${budget.id}`} className="truncate font-semibold hover:underline">
                      {budget.name}
                    </Link>
                    <BudgetHealthBadge health={getBudgetHealth(budget)} />
                  </div>
                  {budget.currentPeriod ? (
                    <>
                      <BudgetProgressBar summary={summarizePeriod(budget.currentPeriod)} size="sm" />
                      <p className="font-mono tabular-nums text-[11px] text-muted-foreground">
                        {money(budget.currentPeriod.spentAmount)} of {money(budget.currentPeriod.allocatedAmount)}
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">Waiting for the first matching expense.</p>
                  )}
                </li>
              ))}
            </ul>

            {hiddenCount > 0 && (
              <Link
                to="/budgets"
                className="inline-flex items-center gap-1 pt-1 text-[11px] font-medium text-primary hover:underline"
              >
                <span>+{hiddenCount} more in Budgets</span>
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
