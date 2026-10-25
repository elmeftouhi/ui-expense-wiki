import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ApiClientError } from '@/api/client'
import { useActiveTenant } from '@/features/tenants'
import { useToast } from '@/components/ui/use-toast'
import { BackfillPaymentModal } from '../components/BackfillPaymentModal'
import { createBackfillPaymentSchema, localToday, toBackfillPayload } from '../schemas/backfillPaymentSchema'
import { SubscriptionPaymentsHistory } from '../components/SubscriptionPaymentsHistory'
import { SubscriptionDetailsPage } from '../pages/SubscriptionDetailsPage'
import { subscriptionService } from '../services/subscriptionService'
import type { BackfillSubscriptionPaymentResult } from '../types'
import { payment, subscription, tenantContext } from './fixtures'

vi.mock('@/features/tenants', () => ({ useActiveTenant: vi.fn() }))
vi.mock('@/components/ui/use-toast', () => ({ useToast: vi.fn() }))

const success = vi.fn(() => 1)
const info = vi.fn(() => 1)
const error = vi.fn(() => 1)
const clients: QueryClient[] = []
const historyPage = { content: [payment], page: 0, size: 10, totalElements: 1, totalPages: 1 }
const backfilledPayment = { ...payment, id: 70, expenseId: 880, scheduledBillingDate: '2026-09-05', expenseDueDate: '2026-09-05', expenseStatus: 'PAID' as const, expensePaidDate: '2026-09-05' }
const generatedResult: BackfillSubscriptionPaymentResult = {
  generated: true, alreadyExists: false, message: 'Historical payment created',
  paymentId: 70, expenseId: 880, scheduledBillingDate: '2026-09-05',
}

function tomorrow() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return localToday(date)
}

function wrapper(path = '/subscriptions/12') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></QueryClientProvider>
  }
  return { client, Wrapper }
}

function renderDetails() {
  return render(<Routes><Route path="/subscriptions/:subscriptionId" element={<SubscriptionDetailsPage />} /></Routes>, { wrapper: wrapper().Wrapper })
}

async function openModal() {
  await screen.findByRole('heading', { name: 'Design tools' })
  await userEvent.click(screen.getByRole('button', { name: 'Add historical payment' }))
  return screen.getByRole('dialog')
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

describe('backfill form validation', () => {
  const schema = createBackfillPaymentSchema(() => '2026-10-25')
  const issues = (values: { scheduledBillingDate: string; paidDate: string }) => {
    const result = schema.safeParse(values)
    return result.success ? [] : result.error.issues.map((issue) => issue.message)
  }

  it('requires a scheduled billing date that is today or in the past', () => {
    expect(issues({ scheduledBillingDate: '', paidDate: '' })).toContain('Choose the scheduled billing date.')
    expect(issues({ scheduledBillingDate: '2026-10-26', paidDate: '' })).toEqual(['Scheduled billing date cannot be in the future.'])
    expect(issues({ scheduledBillingDate: '2026-10-25', paidDate: '' })).toEqual([])
    expect(issues({ scheduledBillingDate: '2024-01-31', paidDate: '' })).toEqual([])
  })

  it('rejects impossible dates and accepts an optional paid date', () => {
    expect(issues({ scheduledBillingDate: '2026-02-30', paidDate: '' })).toEqual(['Enter a valid scheduled billing date.'])
    expect(issues({ scheduledBillingDate: '2026-10-01', paidDate: '2026-13-01' })).toEqual(['Enter a valid paid date.'])
    expect(issues({ scheduledBillingDate: '2026-10-01', paidDate: 'not-a-date' })).toEqual(['Enter a valid paid date.'])
    expect(issues({ scheduledBillingDate: '2024-02-29', paidDate: '2024-03-01' })).toEqual([])
  })

  it('builds the request payload without an empty paid date', () => {
    expect(toBackfillPayload({ scheduledBillingDate: '2026-09-05', paidDate: '' })).toEqual({ scheduledBillingDate: '2026-09-05' })
    expect(toBackfillPayload({ scheduledBillingDate: '2026-09-05', paidDate: '2026-09-06' })).toEqual({ scheduledBillingDate: '2026-09-05', paidDate: '2026-09-06' })
  })
})

describe('add historical payment on subscription details', () => {
  it('hides the action from viewers', async () => {
    vi.mocked(useActiveTenant).mockReturnValue({ ...tenantContext, canEdit: false, currentRole: 'VIEWER' })
    renderDetails()
    await screen.findByRole('heading', { name: 'Design tools' })
    expect(screen.queryByRole('button', { name: 'Add historical payment' })).not.toBeInTheDocument()
  })

  it('opens a modal with an explanatory note, prefills the paid date, and blocks future dates', async () => {
    const backfill = vi.spyOn(subscriptionService, 'backfillSubscriptionPayment')
    renderDetails()
    const dialog = await openModal()
    expect(within(dialog).getByText(/past payments or imports/)).toBeInTheDocument()
    const scheduled = within(dialog).getByLabelText(/Scheduled billing date/)
    expect(scheduled).toHaveAttribute('max', localToday())

    await userEvent.type(scheduled, '2026-09-05')
    expect(within(dialog).getByLabelText('Paid date')).toHaveValue('2026-09-05')

    await userEvent.clear(scheduled)
    await userEvent.type(scheduled, tomorrow())
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add payment' }))
    expect(await within(dialog).findByText('Scheduled billing date cannot be in the future.')).toBeInTheDocument()
    expect(backfill).not.toHaveBeenCalled()
  })

  it('keeps a manually edited paid date when the scheduled date changes', async () => {
    renderDetails()
    const dialog = await openModal()
    const scheduled = within(dialog).getByLabelText(/Scheduled billing date/)
    const paid = within(dialog).getByLabelText('Paid date')
    await userEvent.type(scheduled, '2026-09-05')
    await userEvent.clear(paid)
    await userEvent.type(paid, '2026-09-08')
    await userEvent.clear(scheduled)
    await userEvent.type(scheduled, '2026-09-04')
    expect(paid).toHaveValue('2026-09-08')
  })

  it('submits, shows a success toast, closes, and refreshes history and summary', async () => {
    let finish!: (result: BackfillSubscriptionPaymentResult) => void
    const backfill = vi.spyOn(subscriptionService, 'backfillSubscriptionPayment')
      .mockImplementation(() => new Promise((resolve) => { finish = resolve }))
    vi.mocked(subscriptionService.payments)
      .mockResolvedValueOnce(historyPage)
      .mockResolvedValue({ ...historyPage, content: [payment, backfilledPayment], totalElements: 2 })
    vi.mocked(subscriptionService.getById)
      .mockResolvedValueOnce(subscription)
      .mockResolvedValue({ ...subscription, nextBillingDate: '2026-12-05' })
    renderDetails()
    await screen.findByRole('link', { name: '#902' })
    const dialog = await openModal()
    await userEvent.type(within(dialog).getByLabelText(/Scheduled billing date/), '2026-09-05')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add payment' }))

    const pending = within(dialog).getByRole('button', { name: 'Adding payment...' })
    expect(pending).toBeDisabled()
    expect(backfill).toHaveBeenCalledExactlyOnceWith(12, { scheduledBillingDate: '2026-09-05', paidDate: '2026-09-05' })
    finish(generatedResult)

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(success).toHaveBeenCalledWith('Historical payment added', 'Historical payment created')
    const table = await screen.findByRole('table', { name: 'Payments history' })
    expect(await within(table).findByRole('link', { name: '#880' })).toBeInTheDocument()
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell')[0].textContent)).toEqual(['Oct 5, 2026', 'Sep 5, 2026'])
    expect(await screen.findByText('Dec 5, 2026')).toBeInTheDocument()
    expect(subscriptionService.payments).toHaveBeenLastCalledWith(12, { page: 0, size: 10, sort: 'scheduledBillingDate', direction: 'desc' })
  })

  it('reports an existing payment with the backend message as info', async () => {
    vi.spyOn(subscriptionService, 'backfillSubscriptionPayment').mockResolvedValue({
      generated: false, alreadyExists: true, message: 'A payment for 2026-10-05 already exists.',
      paymentId: null, expenseId: null, scheduledBillingDate: '2026-10-05',
    })
    renderDetails()
    const dialog = await openModal()
    await userEvent.type(within(dialog).getByLabelText(/Scheduled billing date/), '2026-10-05')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add payment' }))
    await waitFor(() => expect(info).toHaveBeenCalledWith('Payment already exists', 'A payment for 2026-10-05 already exists.'))
    expect(success).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('shows backend errors in an alert, keeps the modal open, and allows retry', async () => {
    const backfill = vi.spyOn(subscriptionService, 'backfillSubscriptionPayment')
      .mockRejectedValueOnce(new ApiClientError('Scheduled billing date is before the subscription start.', 400))
      .mockResolvedValue(generatedResult)
    renderDetails()
    const dialog = await openModal()
    await userEvent.type(within(dialog).getByLabelText(/Scheduled billing date/), '2026-09-05')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add payment' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Scheduled billing date is before the subscription start.')
    expect(error).toHaveBeenCalledWith('Could not add historical payment', 'Scheduled billing date is before the subscription start.')
    expect(within(dialog).getByRole('button', { name: 'Add payment' })).toBeEnabled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add payment' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(backfill).toHaveBeenCalledTimes(2)
  })
})

describe('BackfillPaymentModal standalone', () => {
  it('does not refresh history when the request fails', async () => {
    vi.spyOn(subscriptionService, 'backfillSubscriptionPayment').mockRejectedValue(new ApiClientError('Server error', 500))
    render(<><BackfillPaymentModal subscriptionId={12} onClose={() => {}} /><SubscriptionPaymentsHistory subscriptionId={12} /></>, { wrapper: wrapper().Wrapper })
    await screen.findByRole('link', { name: '#902' })
    await userEvent.type(screen.getByLabelText(/Scheduled billing date/), '2026-09-05')
    await userEvent.click(screen.getByRole('button', { name: 'Add payment' }))
    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(subscriptionService.payments).toHaveBeenCalledTimes(1)
  })
})
