import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { queryKeys } from '@/api/query-keys'
import { useActiveTenant } from '@/features/tenants'
import { useToast } from '@/components/ui/use-toast'
import { ExpenseTable } from '@/features/expenses/components/ExpenseTable'
import { ExpenseActions } from '@/features/expenses/components/ExpenseActions'
import { ExpenseDetailsPage } from '@/features/expenses/pages/ExpenseDetailsPage'
import { useExpenses } from '@/features/expenses/hooks/useExpenses'
import { expenseService } from '@/features/expenses/services/expenseService'
import { expense } from '@/features/expenses/__tests__/expenseFixtures'
import { GenerateNextPaymentButton } from '../components/GenerateNextPaymentButton'
import { SubscriptionPaymentsHistory } from '../components/SubscriptionPaymentsHistory'
import { SubscriptionDetailsPage } from '../pages/SubscriptionDetailsPage'
import { subscriptionService } from '../services/subscriptionService'
import { payment, subscription, tenantContext } from './fixtures'
import type { GeneratePaymentResult, SubscriptionStatus } from '../types'

vi.mock('@/features/tenants', () => ({ useActiveTenant: vi.fn() }))
vi.mock('@/components/ui/use-toast', () => ({ useToast: vi.fn() }))

const success = vi.fn(() => 1)
const info = vi.fn(() => 1)
const error = vi.fn(() => 1)
const clients: QueryClient[] = []
const historyPage = { content: [payment], page: 0, size: 10, totalElements: 1, totalPages: 1 }
const linkedExpense = {
  ...expense, id: payment.expenseId, subscriptionPaymentId: payment.id, tenantId: 101,
  amount: payment.expenseAmount, currency: payment.expenseCurrency, status: payment.expenseStatus,
  dueDate: payment.expenseDueDate,
}

function wrapper(path = '/subscriptions/12') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></QueryClientProvider>
  }
  return { client, Wrapper }
}

function Expenses() {
  const query = useExpenses({ page: 0, size: 10, sort: 'dueDate', direction: 'desc' })
  return <section aria-label="Expenses"><ExpenseTable expenses={query.data?.content ?? []} canEdit={false} page={0} totalPages={1} onPageChange={() => {}} /></section>
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useActiveTenant).mockReturnValue(tenantContext)
  vi.mocked(useToast).mockReturnValue({ success, info, error, toast: vi.fn(() => 1), dismiss: vi.fn() })
  vi.spyOn(subscriptionService, 'payments').mockResolvedValue(historyPage)
  vi.spyOn(subscriptionService, 'getById').mockResolvedValue(subscription)
})

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

describe('payments history', () => {
  it('renders every billing and expense field, including paid and unpaid dates', async () => {
    vi.mocked(subscriptionService.payments).mockResolvedValue({
      ...historyPage, totalElements: 2, content: [
        payment,
        { ...payment, id: 82, expenseId: 903, expenseStatus: 'PAID', expensePaidDate: '2026-10-06' },
      ],
    })
    render(<SubscriptionPaymentsHistory subscriptionId={12} />, { wrapper: wrapper().Wrapper })
    const table = await screen.findByRole('table', { name: 'Payments history' })
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Scheduled billing date', 'Expense ID', 'Amount', 'Currency', 'Status', 'Due date', 'Paid date',
    ])
    const row = within(table).getAllByRole('row')[1]
    expect(within(row).getAllByRole('cell').map((cell) => cell.textContent)).toEqual([
      'Oct 5, 2026', '#902', '$45.00', 'USD', 'PENDING', 'Oct 5, 2026', '—',
    ])
    expect(within(table).getByText('Oct 6, 2026')).toBeInTheDocument()
    expect(within(table).getByRole('link', { name: '#902' })).toHaveAttribute('href', '/expenses/902')
  })

  it('shows loading, then an actionable empty state', async () => {
    let finish!: (value: typeof historyPage) => void
    vi.mocked(subscriptionService.payments).mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    render(<SubscriptionPaymentsHistory subscriptionId={12} />, { wrapper: wrapper().Wrapper })
    expect(screen.getByRole('status', { name: 'Loading payment history' })).toHaveAttribute('aria-busy', 'true')
    finish({ ...historyPage, content: [], totalElements: 0, totalPages: 0 })
    expect(await screen.findByText('No payments yet')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })
})

describe('payment-linked expense details and actions', () => {
  it('loads the explicit payment link and navigates to its subscription', async () => {
    vi.mocked(useActiveTenant).mockReturnValue({ ...tenantContext, canEdit: false, currentRole: 'VIEWER' })
    vi.spyOn(expenseService, 'getById').mockResolvedValue(linkedExpense)
    const getPayment = vi.spyOn(subscriptionService, 'getPaymentById').mockResolvedValue(payment)
    render(<Routes>
      <Route path="/expenses/:expenseId" element={<ExpenseDetailsPage />} />
      <Route path="/subscriptions/:subscriptionId" element={<p>Subscription schedule</p>} />
    </Routes>, { wrapper: wrapper('/expenses/902').Wrapper })
    const link = await screen.findByRole('link', { name: 'View subscription #12' })
    expect(getPayment).toHaveBeenCalledExactlyOnceWith(81)
    expect(screen.getByRole('heading', { name: 'Subscription payment #81' })).toBeInTheDocument()
    expect(screen.getByText('Subscription')).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
    await userEvent.click(link)
    expect(await screen.findByText('Subscription schedule')).toBeInTheDocument()
  })

  it('does not infer a subscription link from legacy origin metadata alone', async () => {
    vi.spyOn(expenseService, 'getById').mockResolvedValue({ ...expense, type: 'SUBSCRIPTION', hasSubscription: true })
    const getPayment = vi.spyOn(subscriptionService, 'getPaymentById')
    render(<Routes><Route path="/expenses/:expenseId" element={<ExpenseDetailsPage />} /></Routes>, { wrapper: wrapper('/expenses/7').Wrapper })
    await screen.findByRole('heading', { name: 'Electricity bill' })
    expect(screen.getByText('Subscription')).toBeInTheDocument()
    expect(getPayment).not.toHaveBeenCalled()
    expect(screen.queryByRole('link', { name: /View subscription/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Mark as paid' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Change status' })).toBeInTheDocument()
  })

  it('keeps expense actions available when the payment fails to load and supports retry', async () => {
    vi.spyOn(expenseService, 'getById').mockResolvedValue(linkedExpense)
    vi.spyOn(subscriptionService, 'getPaymentById')
      .mockRejectedValueOnce(new Error('Payment unavailable')).mockResolvedValue(payment)
    render(<Routes><Route path="/expenses/:expenseId" element={<ExpenseDetailsPage />} /></Routes>, { wrapper: wrapper('/expenses/902').Wrapper })
    expect(await screen.findByRole('alert')).toHaveTextContent('Payment unavailable')
    expect(screen.getByRole('button', { name: 'Mark as paid' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Retry linked payment' }))
    expect(await screen.findByRole('link', { name: 'View subscription #12' })).toBeInTheDocument()
  })

  it('does not display a subscription link for a payment belonging to a different expense', async () => {
    vi.spyOn(expenseService, 'getById').mockResolvedValue(linkedExpense)
    vi.spyOn(subscriptionService, 'getPaymentById').mockResolvedValue({ ...payment, expenseId: 999 })
    render(<Routes><Route path="/expenses/:expenseId" element={<ExpenseDetailsPage />} /></Routes>, { wrapper: wrapper('/expenses/902').Wrapper })
    expect(await screen.findByRole('alert')).toHaveTextContent('The payment does not link to this expense.')
    expect(screen.queryByRole('link', { name: /View subscription/ })).not.toBeInTheDocument()
  })

  it('marks a linked expense paid using normal actions and refreshes payment history', async () => {
    const paidExpense = { ...linkedExpense, status: 'PAID' as const, paidDate: '2026-10-06' }
    const paidPayment = { ...payment, expenseStatus: 'PAID' as const, expensePaidDate: '2026-10-06' }
    const markPaid = vi.spyOn(expenseService, 'markAsPaid').mockResolvedValue(paidExpense)
    vi.mocked(subscriptionService.payments).mockResolvedValueOnce(historyPage).mockResolvedValue({ ...historyPage, content: [paidPayment] })
    const { client, Wrapper } = wrapper()
    const paymentKey = queryKeys.tenantScope(101).subscriptionPayments.detail(81)
    client.setQueryData(paymentKey, payment)
    render(<><ExpenseActions expense={linkedExpense} canEdit /><SubscriptionPaymentsHistory subscriptionId={12} /></>, { wrapper: Wrapper })
    await screen.findByText('PENDING')
    await userEvent.click(screen.getByRole('button', { name: 'Mark as paid' }))
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText('Paid date'))
    await user.type(screen.getByLabelText('Paid date'), '2026-10-06')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark as paid' }))
    expect(await screen.findByText('PAID')).toBeInTheDocument()
    expect(screen.getByText('Oct 6, 2026')).toBeInTheDocument()
    expect(markPaid).toHaveBeenCalledExactlyOnceWith(902, '2026-10-06')
    expect(client.getQueryState(paymentKey)?.isInvalidated).toBe(true)
  })
})

const generatedResult: GeneratePaymentResult = {
  generated: true, alreadyExists: false, message: 'Next payment generated successfully',
  paymentId: payment.id, expenseId: payment.expenseId, scheduledBillingDate: payment.scheduledBillingDate,
}
const existingResult: GeneratePaymentResult = {
  ...generatedResult, generated: false, alreadyExists: true, message: 'A payment for this billing date already exists.',
}

describe('generate next payment', () => {
  it.each<SubscriptionStatus>(['PAUSED', 'STOPPED', 'ENDED'])('does not generate for %s subscriptions', async (status) => {
    const generate = vi.spyOn(subscriptionService, 'generateNextPayment')
    render(<GenerateNextPaymentButton subscriptionId={12} status={status} />, { wrapper: wrapper().Wrapper })
    const button = screen.getByRole('button', { name: 'Generate next payment' })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription('Only active subscriptions can generate payments')
    await userEvent.click(button)
    expect(generate).not.toHaveBeenCalled()
  })

  it('links to the generated expense using the IDs returned by the backend', async () => {
    vi.spyOn(subscriptionService, 'generateNextPayment').mockResolvedValue({ ...generatedResult, paymentId: 155, expenseId: 89 })
    render(<Routes>
      <Route path="/subscriptions/:subscriptionId" element={<GenerateNextPaymentButton subscriptionId={12} status="ACTIVE" />} />
      <Route path="/expenses/:expenseId" element={<p>Expense 89 details</p>} />
    </Routes>, { wrapper: wrapper().Wrapper })
    await userEvent.click(screen.getByRole('button', { name: 'Generate next payment' }))
    expect(await screen.findByText(/Generated payment #155/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'View expense #89' }))
    expect(await screen.findByText('Expense 89 details')).toBeInTheDocument()
  })

  it('hides the generation action from viewers on subscription details', async () => {
    vi.mocked(useActiveTenant).mockReturnValue({ ...tenantContext, canEdit: false, currentRole: 'VIEWER' })
    render(<Routes><Route path="/subscriptions/:subscriptionId" element={<SubscriptionDetailsPage />} /></Routes>, { wrapper: wrapper().Wrapper })
    await screen.findByRole('heading', { name: 'Design tools' })
    expect(screen.queryByRole('button', { name: 'Generate next payment' })).not.toBeInTheDocument()
  })

  it('prevents repeat clicks and refetches history and expenses after generation, scoped to the tenant', async () => {
    let finish!: (result: GeneratePaymentResult) => void
    const generate = vi.spyOn(subscriptionService, 'generateNextPayment').mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    vi.mocked(subscriptionService.payments).mockResolvedValueOnce({ ...historyPage, content: [], totalElements: 0 })
    const list = vi.spyOn(expenseService, 'list')
      .mockResolvedValueOnce({ ...historyPage, content: [], totalElements: 0 })
      .mockResolvedValue({ ...historyPage, content: [linkedExpense] })
    const { client, Wrapper } = wrapper()
    const otherKeys = queryKeys.tenantScope(202)
    client.setQueryData(otherKeys.expenses.all, ['unchanged'])
    client.setQueryData(otherKeys.subscriptions.all, ['unchanged'])
    render(<><GenerateNextPaymentButton subscriptionId={12} status="ACTIVE" /><SubscriptionPaymentsHistory subscriptionId={12} /><Expenses /></>, { wrapper: Wrapper })
    await screen.findByText('No payments yet')
    await userEvent.click(screen.getByRole('button', { name: 'Generate next payment' }))
    const pending = screen.getByRole('button', { name: 'Generating payment...' })
    expect(pending).toBeDisabled()
    expect(pending).toHaveAttribute('aria-busy', 'true')
    await userEvent.click(pending)
    expect(generate).toHaveBeenCalledExactlyOnceWith(12)
    finish(generatedResult)
    expect(await screen.findByRole('link', { name: '#902' })).toBeInTheDocument()
    const expenses = screen.getByRole('region', { name: 'Expenses' })
    expect(await within(expenses).findByText('Electricity bill')).toBeInTheDocument()
    expect(within(expenses).getByText('Subscription')).toBeInTheDocument()
    expect(within(expenses).getByText('pending')).toBeInTheDocument()
    expect(subscriptionService.payments).toHaveBeenCalledTimes(2)
    expect(list).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(success).toHaveBeenCalledWith('Payment generated', 'Next payment generated successfully'))
    expect(client.getQueryState(otherKeys.expenses.all)?.isInvalidated).toBe(false)
    expect(client.getQueryState(otherKeys.subscriptions.all)?.isInvalidated).toBe(false)
  })

  it('reports an existing payment as info and refetches without appending a duplicate', async () => {
    vi.spyOn(subscriptionService, 'generateNextPayment').mockResolvedValue(existingResult)
    render(<><GenerateNextPaymentButton subscriptionId={12} status="ACTIVE" /><SubscriptionPaymentsHistory subscriptionId={12} /></>, { wrapper: wrapper().Wrapper })
    await screen.findByText('#902')
    await userEvent.click(screen.getByRole('button', { name: 'Generate next payment' }))
    await waitFor(() => expect(info).toHaveBeenCalledWith('Payment already generated', 'A payment for this billing date already exists.'))
    expect(success).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    expect(screen.getAllByRole('link', { name: '#902' })).toHaveLength(1)
    expect(screen.getByRole('link', { name: 'View existing expense #902' })).toHaveAttribute('href', '/expenses/902')
    expect(subscriptionService.payments).toHaveBeenCalledTimes(2)
  })

  it('reports errors, keeps existing history, and allows retry', async () => {
    const generate = vi.spyOn(subscriptionService, 'generateNextPayment')
      .mockRejectedValueOnce(new Error('Billing service unavailable'))
      .mockResolvedValue(generatedResult)
    render(<><GenerateNextPaymentButton subscriptionId={12} status="ACTIVE" /><SubscriptionPaymentsHistory subscriptionId={12} /></>, { wrapper: wrapper().Wrapper })
    await screen.findByText('#902')
    await userEvent.click(screen.getByRole('button', { name: 'Generate next payment' }))
    await waitFor(() => expect(error).toHaveBeenCalledWith('Payment generation failed', 'Billing service unavailable'))
    expect(screen.getByText('#902')).toBeInTheDocument()
    expect(subscriptionService.payments).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', { name: 'Generate next payment' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Generate next payment' }))
    await waitFor(() => expect(success).toHaveBeenCalled())
    expect(generate).toHaveBeenCalledTimes(2)
  })
})
