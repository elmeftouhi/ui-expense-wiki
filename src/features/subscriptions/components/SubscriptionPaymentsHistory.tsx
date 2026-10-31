import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveTenant } from '@/features/tenants'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { useMediaQuery } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { useSubscriptionPayments } from '../hooks/useSubscriptions'

export function SubscriptionPaymentsHistory({
  subscriptionId,
  headerAction,
}: {
  subscriptionId: number
  headerAction?: ReactNode
}) {
  const { activeTenant } = useActiveTenant()
  const isDesktop = useMediaQuery('(min-width: 768px)', true)
  const [page, setPage] = useState(0)
  const history = useSubscriptionPayments(subscriptionId, {
    page,
    size: 10,
    sort: 'scheduledBillingDate',
    direction: 'desc',
  })
  const date = (value?: string | null) => formatDate(value, { locale: activeTenant.locale, timeZone: 'UTC' })

  const items = history.data?.content ?? []
  const totalPages = history.data?.totalPages ?? 0

  return (
    <Card className="overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 px-4 py-3.5 sm:px-5">
        <CardTitle className="text-sm font-semibold">Payments history</CardTitle>
        <div className="flex items-center gap-1.5">
          {headerAction}
          <Button
            variant="ghost"
            size="sm"
            aria-label="Refresh payment history"
            disabled={history.isFetching}
            onClick={() => void history.refetch()}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', history.isFetching && 'animate-spin motion-reduce:animate-none')} />
          </Button>
        </div>
      </CardHeader>

      <div className="border-t border-border/60">
        {history.isLoading ? (
          <div
            role="status"
            aria-label="Loading payment history"
            aria-busy="true"
            className="space-y-2 p-4 sm:p-5"
          >
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : history.isError ? (
          <div role="alert" className="flex flex-col items-center gap-2 px-5 py-10 text-center">
            <p className="text-xs text-destructive">
              {getApiErrorMessage(history.error, 'Could not load payment history.')}
            </p>
            <Button variant="outline" size="sm" onClick={() => void history.refetch()} className="text-xs">
              Retry history
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-xs font-semibold text-foreground">No payments yet</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Generated billing expenses will appear here.
            </p>
          </div>
        ) : isDesktop ? (
          <div className="custom-scrollbar overflow-x-auto">
            <table aria-label="Payments history" className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-border/60 bg-muted/25 text-[11px] font-medium text-muted-foreground">
                <tr>
                  {[
                    'Scheduled billing date',
                    'Expense ID',
                    'Amount',
                    'Currency',
                    'Status',
                    'Due date',
                    'Paid date',
                  ].map((label) => (
                    <th key={label} scope="col" className="px-4 py-2.5">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {items.map((payment) => (
                  <tr key={payment.id} className="transition-colors hover:bg-muted/25">
                    <td className="px-4 py-3 font-medium text-foreground">{date(payment.scheduledBillingDate)}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      <Link
                        to={`/expenses/${payment.expenseId}`}
                        className="underline underline-offset-4 hover:text-foreground"
                      >
                        #{payment.expenseId}
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold tabular-nums text-foreground">
                      {formatCurrency(payment.expenseAmount, {
                        currency: payment.expenseCurrency,
                        locale: activeTenant.locale,
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{payment.expenseCurrency}</td>
                    <td className="px-4 py-3">
                      <Badge
                        variant={
                          payment.expenseStatus === 'PAID'
                            ? 'success'
                            : payment.expenseStatus === 'OVERDUE'
                            ? 'destructive'
                            : 'secondary'
                        }
                        className="px-1.5 py-0 text-[10px]"
                      >
                        {payment.expenseStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{date(payment.expenseDueDate)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{date(payment.expensePaidDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <ul aria-label="Payments history" className="divide-y divide-border/60">
            {items.map((payment) => (
              <li key={payment.id} className="space-y-1.5 p-4 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground">{date(payment.scheduledBillingDate)}</span>
                  <Badge
                    variant={
                      payment.expenseStatus === 'PAID'
                        ? 'success'
                        : payment.expenseStatus === 'OVERDUE'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="px-1.5 py-0 text-[10px]"
                  >
                    {payment.expenseStatus}
                  </Badge>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {formatCurrency(payment.expenseAmount, {
                      currency: payment.expenseCurrency,
                      locale: activeTenant.locale,
                    })}
                  </span>
                  <Link
                    to={`/expenses/${payment.expenseId}`}
                    className="font-mono text-[11px] text-primary underline underline-offset-4"
                  >
                    Expense #{payment.expenseId}
                  </Link>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span>Due {date(payment.expenseDueDate)}</span>
                  {payment.expensePaidDate && <span>Paid {date(payment.expensePaidDate)}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!history.isLoading && !history.isError && items.length > 0 && (
        <footer className="flex items-center justify-between border-t border-border/60 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="font-mono tabular-nums">{history.data?.totalElements ?? 0} payments</span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              aria-label="Previous history page"
              disabled={page <= 0 || history.isFetching}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
              className="h-7 w-7 p-0"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-1 font-mono tabular-nums">
              {totalPages ? page + 1 : 0} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              aria-label="Next history page"
              disabled={page + 1 >= totalPages || history.isFetching}
              onClick={() => setPage((current) => current + 1)}
              className="h-7 w-7 p-0"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </footer>
      )}
    </Card>
  )
}
