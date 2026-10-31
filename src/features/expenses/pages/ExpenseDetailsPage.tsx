import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { ReactNode } from 'react'
import { ArrowLeft, CalendarDays, CreditCard, PencilLine, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useActiveTenant } from '@/features/tenants'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { getApiErrorMessage } from '@/lib/api-error'
import { ExpenseActions } from '../components/ExpenseActions'
import { ExpenseStatusBadge } from '../components/ExpenseStatusBadge'
import { useExpense } from '../hooks/useExpenses'
import { SubscriptionOriginBadge } from '../components/SubscriptionOriginBadge'
import { isSubscriptionExpense } from '../utils/subscriptionOrigin'
import { useSubscriptionPayment } from '@/features/subscriptions/hooks/useSubscriptions'

function LinkedSubscriptionPayment({ paymentId, expenseId }: { paymentId: number; expenseId: number }) {
  const payment = useSubscriptionPayment(paymentId)
  const { activeTenant } = useActiveTenant()
  return (
    <section className="space-y-2 rounded-lg border border-primary/20 bg-primary/[0.04] p-4">
      <h2 className="text-sm font-semibold">Subscription payment #{paymentId}</h2>
      {payment.isLoading ? <p role="status" className="text-sm text-muted-foreground">Loading linked payment...</p>
        : payment.isError || !payment.data || payment.data.expenseId !== expenseId ? (
          <div role="alert" className="space-y-2">
            <p className="text-sm text-destructive">{payment.data?.expenseId !== undefined && payment.data.expenseId !== expenseId
              ? 'The payment does not link to this expense.'
              : getApiErrorMessage(payment.error, 'Could not load linked payment.')}</p>
            <Button size="sm" variant="outline" onClick={() => void payment.refetch()}>Retry linked payment</Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            <Link className="text-foreground underline underline-offset-4" to={`/subscriptions/${payment.data.subscriptionId}`}>View subscription #{payment.data.subscriptionId}</Link>
            {' '}for the payment scheduled on {formatDate(payment.data.scheduledBillingDate, { locale: activeTenant.locale, timeZone: 'UTC' })}.
          </p>
        )}
    </section>
  )
}

export function ExpenseDetailsPage() {
  const { expenseId: rawId } = useParams()
  const expenseId = rawId ? Number(rawId) : undefined
  const expense = useExpense(expenseId)
  const { activeTenant, canEdit } = useActiveTenant()
  const navigate = useNavigate()
  const location = useLocation()
  const fromSearch = (location.state as { fromExpensesSearch?: string } | null)?.fromExpensesSearch
  const backPath = fromSearch ? `/expenses${fromSearch}` : '/expenses'

  if (expense.isLoading) return <Card><CardContent className="p-8 text-sm text-muted-foreground">Loading expense…</CardContent></Card>
  if (expense.error || !expense.data) {
    return <Card><CardContent className="space-y-4 p-8"><p role="alert" className="text-sm text-destructive">{getApiErrorMessage(expense.error, 'Expense could not be loaded.')}</p><Button asChild variant="outline"><Link to={backPath}>Back to expenses</Link></Button></CardContent></Card>
  }

  const item = expense.data
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to={backPath} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Back to expenses</Link>
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-2.5"><h1 className="max-w-2xl text-2xl sm:text-3xl font-bold tracking-tight">{item.description}</h1><ExpenseStatusBadge status={item.status} /><SubscriptionOriginBadge expense={item} /></div>
          <p className="mt-1.5 text-sm text-muted-foreground">{isSubscriptionExpense(item) ? 'Subscription expense' : 'Expense'} · Recorded {formatDate(item.createdAt, { locale: activeTenant.locale })}</p>
        </div>
        {canEdit && <Button asChild variant="outline" size="sm" className="gap-2 self-start"><Link to={`/expenses/${item.id}/edit`} state={location.state}><PencilLine className="h-4 w-4" />Edit expense</Link></Button>}
      </header>
      <Card>
        <CardContent className="grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2 sm:p-7">
          <div className="sm:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">Amount</p>
            <p className="mt-1 font-mono text-2xl sm:text-3xl font-bold tabular-nums">{formatCurrency(item.amount, { currency: item.currency, locale: activeTenant.locale })}</p>
          </div>
          <DetailField icon={<Tag className="h-4 w-4" />} label="Category"><Link to={`/expenses?categories=${item.categoryId}`} className="underline-offset-4 hover:underline">{item.categoryName}</Link></DetailField>
          <DetailField icon={<CalendarDays className="h-4 w-4" />} label="Due date">{formatDate(item.dueDate, { locale: activeTenant.locale, timeZone: 'UTC' })}</DetailField>
          <DetailField icon={<CalendarDays className="h-4 w-4" />} label="Paid date">{formatDate(item.paidDate, { locale: activeTenant.locale, timeZone: 'UTC' })}</DetailField>
          <DetailField icon={<CreditCard className="h-4 w-4" />} label="Payment method">{item.paymentMethod || 'Not specified'}</DetailField>
          <DetailField icon={<Tag className="h-4 w-4" />} label="Type">{item.type === 'SUBSCRIPTION' ? 'Subscription bill' : 'Normal expense'}</DetailField>
          {item.notes && <div className="sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Notes</p><p className="mt-1 whitespace-pre-wrap text-sm">{item.notes}</p></div>}
          {isSubscriptionExpense(item) && <p className="sm:col-span-2 rounded-lg border border-primary/20 bg-primary/[0.04] p-3 text-sm text-muted-foreground">This expense originated from a subscription payment. Expense actions do not change the subscription schedule.</p>}
        </CardContent>
      </Card>
      {item.subscriptionPaymentId != null && <LinkedSubscriptionPayment key={`${activeTenant.id}:${item.subscriptionPaymentId}`} paymentId={item.subscriptionPaymentId} expenseId={item.id} />}
      {canEdit && <section className="space-y-3"><h2 className="text-lg font-semibold">Quick actions</h2><ExpenseActions expense={item} canEdit={canEdit} fromSearch={fromSearch} onDeleted={() => navigate(backPath)} /></section>}
    </div>
  )
}

function DetailField({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return <div>
    <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">{icon}{label}</p>
    <div className="mt-1 text-sm font-medium">{children}</div>
  </div>
}
