import { Link } from 'react-router-dom'
import { PiggyBank } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { useBudgets } from '../hooks/useBudgets'
import { getBudgetHealth, summarizePeriod, summarizePortfolio } from '../utils/budgetMath'
import { BudgetHealthBadge } from './BudgetStatusBadges'
import { BudgetProgressBar } from './BudgetProgressBar'

interface BudgetConsumptionWidgetProps {
  currency: string
  locale: string
}

export function BudgetConsumptionWidget({ currency, locale }: BudgetConsumptionWidgetProps) {
  const { data: budgets = [], isLoading, isError, error, refetch } = useBudgets()
  const activeBudgets = budgets.filter((budget) => budget.active)
  const summary = summarizePortfolio(activeBudgets)
  const money = (amount: number) => formatCurrency(amount, { currency, locale })

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <PiggyBank className="h-4 w-4 text-primary" />
          Budget consumption
        </CardTitle>
        <CardDescription>Current periods across active budgets.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {isLoading ? (
          <p role="status" className="text-muted-foreground">Loading budgets...</p>
        ) : isError ? (
          <div role="alert" className="space-y-2">
            <p className="text-destructive">{getApiErrorMessage(error, 'Could not load budgets.')}</p>
            <Button variant="outline" size="sm" onClick={() => void refetch()}>Retry budgets</Button>
          </div>
        ) : activeBudgets.length === 0 ? (
          <p className="text-muted-foreground">No active budgets. Create one to track category spending.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border/60 bg-muted/30 p-3">
              <div><dt className="text-muted-foreground">Spent</dt><dd className="font-mono font-semibold">{money(summary.totalSpent)}</dd></div>
              <div><dt className="text-muted-foreground">Allocated</dt><dd className="font-mono font-semibold">{money(summary.totalAllocated)}</dd></div>
            </dl>
            <p className="text-[11px] text-muted-foreground">
              Shared categories count toward each budget, so totals may overlap.
            </p>
            <ul className="divide-y divide-border/40">
              {activeBudgets.slice(0, 4).map((budget) => (
                <li key={budget.id} className="space-y-2 py-3 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <Link to={`/budgets/${budget.id}`} className="truncate font-semibold hover:underline">{budget.name}</Link>
                    <BudgetHealthBadge health={getBudgetHealth(budget)} />
                  </div>
                  {budget.currentPeriod ? (
                    <>
                      <BudgetProgressBar summary={summarizePeriod(budget.currentPeriod)} size="sm" />
                      <p className="font-mono text-muted-foreground">
                        {money(budget.currentPeriod.spentAmount)} of {money(budget.currentPeriod.allocatedAmount)}
                      </p>
                    </>
                  ) : <p className="text-muted-foreground">Waiting for the first matching expense.</p>}
                </li>
              ))}
            </ul>
          </>
        )}
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to="/budgets">View all budgets</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
