import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useActiveTenant } from '@/features/tenants'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { useSubscriptionPayments } from '../hooks/useSubscriptions'

export function SubscriptionPaymentsHistory({ subscriptionId }: { subscriptionId: number }) {
  const { activeTenant } = useActiveTenant()
  const [page, setPage] = useState(0)
  const history = useSubscriptionPayments(subscriptionId, {
    page, size: 10, sort: 'scheduledBillingDate', direction: 'desc',
  })
  const date = (value?: string | null) => formatDate(value, { locale: activeTenant.locale, timeZone: 'UTC' })

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 p-5 pb-3">
        <div><CardTitle className="text-sm">Payments history</CardTitle><CardDescription className="mt-1 text-xs">Each payment links a scheduled billing date to its expense.</CardDescription></div>
        <Button variant="ghost" size="sm" aria-label="Refresh payment history" disabled={history.isFetching} onClick={() => void history.refetch()}>
          <RefreshCw className={cn('h-4 w-4', history.isFetching && 'animate-spin motion-reduce:animate-none')} />
        </Button>
      </CardHeader>
      {history.isLoading ? (
        <div role="status" aria-label="Loading payment history" aria-busy="true" className="space-y-2 p-5">{Array.from({ length: 4 }, (_, index) => <div key={index} className="h-9 animate-pulse rounded bg-muted" />)}</div>
      ) : history.isError ? (
        <div role="alert" className="flex flex-col items-center gap-2 px-5 py-10 text-center">
          <p className="text-xs text-destructive">{getApiErrorMessage(history.error, 'Could not load payment history.')}</p>
          <Button variant="outline" size="sm" onClick={() => void history.refetch()}>Retry history</Button>
        </div>
      ) : history.data?.content.length === 0 ? (
        <div className="px-5 py-12 text-center"><p className="text-sm font-semibold">No payments yet</p><p className="mt-1 text-xs text-muted-foreground">Payments and their linked expenses will appear here when billing is generated.</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table aria-label="Payments history" className="w-full min-w-[860px] text-left text-xs">
            <thead className="bg-muted/40 text-xs font-semibold text-muted-foreground">
              <tr>{['Scheduled billing date', 'Expense ID', 'Amount', 'Currency', 'Status', 'Due date', 'Paid date'].map((label) => <th key={label} scope="col" className="px-4 py-3">{label}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {history.data?.content.map((payment) => (
                <tr key={payment.id}>
                  <td className="px-4 py-3">{date(payment.scheduledBillingDate)}</td>
                  <td className="px-4 py-3 text-muted-foreground"><Link to={`/expenses/${payment.expenseId}`} className="underline underline-offset-4 hover:text-foreground">#{payment.expenseId}</Link></td>
                  <td className="px-4 py-3 font-semibold tabular-nums">{formatCurrency(payment.expenseAmount, { currency: payment.expenseCurrency, locale: activeTenant.locale })}</td>
                  <td className="px-4 py-3">{payment.expenseCurrency}</td>
                  <td className="px-4 py-3"><Badge variant={payment.expenseStatus === 'PAID' ? 'success' : payment.expenseStatus === 'OVERDUE' ? 'destructive' : 'secondary'}>{payment.expenseStatus}</Badge></td>
                  <td className="px-4 py-3">{date(payment.expenseDueDate)}</td>
                  <td className="px-4 py-3">{date(payment.expensePaidDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!history.isLoading && !history.isError && (
        <footer className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-xs text-muted-foreground">
          <span>{history.data?.totalElements ?? 0} payments</span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" aria-label="Previous history page" disabled={page <= 0 || history.isFetching} onClick={() => setPage((current) => Math.max(0, current - 1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span>Page {history.data?.totalPages ? page + 1 : 0} of {history.data?.totalPages ?? 0}</span>
            <Button variant="outline" size="sm" aria-label="Next history page" disabled={page + 1 >= (history.data?.totalPages ?? 0) || history.isFetching} onClick={() => setPage((current) => current + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </footer>
      )}
    </Card>
  )
}
