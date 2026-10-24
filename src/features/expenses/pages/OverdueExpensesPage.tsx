import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, ClockAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useActiveTenant, useResetOnTenantChange } from '@/features/tenants'
import { getApiErrorMessage } from '@/lib/api-error'
import { ExpenseTable } from '../components/ExpenseTable'
import { useOverdueExpenses } from '../hooks/useExpenses'

const PAGE_SIZE = 10

export function OverdueExpensesPage() {
  const { canEdit } = useActiveTenant()
  const overdue = useOverdueExpenses()
  const [page, setPage] = useState(0)
  const resetPage = useCallback(() => setPage(0), [])
  useResetOnTenantChange(resetPage)

  return (
    <div className="space-y-6">
      <Link to="/expenses" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />All expenses</Link>
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Overdue expenses</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Bills past their due date that still need attention.</p>
      </header>
      {overdue.isLoading ? (
        <Card><CardContent className="p-8 text-sm text-muted-foreground">Loading overdue expenses…</CardContent></Card>
      ) : overdue.error ? (
        <Card><CardContent className="space-y-3 p-8 text-center"><ClockAlert className="mx-auto h-8 w-8 text-muted-foreground" /><p role="alert" className="text-sm text-destructive">{getApiErrorMessage(overdue.error, 'Overdue expenses could not be loaded.')}</p><Button variant="outline" onClick={() => void overdue.refetch()}>Try again</Button></CardContent></Card>
      ) : (
        <ExpenseTable
          expenses={(overdue.data ?? []).slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)}
          canEdit={canEdit}
          page={page}
          totalPages={Math.ceil((overdue.data?.length ?? 0) / PAGE_SIZE)}
          onPageChange={setPage}
          emptyMessage="There are no overdue expenses."
        />
      )}
    </div>
  )
}
