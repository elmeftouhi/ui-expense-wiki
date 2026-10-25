import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useActiveTenant } from '@/features/tenants'
import { useToast } from '@/components/ui/use-toast'
import { useCategoryOptions } from '@/features/budgets/hooks/useCategoryOptions'
import { SubscriptionsPage } from '../pages/SubscriptionsPage'
import { SubscriptionDetailsPage } from '../pages/SubscriptionDetailsPage'
import { subscriptionService } from '../services/subscriptionService'
import { categoryOptions, payment, subscription, tenantContext } from './fixtures'
import type { Subscription, SubscriptionFilters, SubscriptionFrequency, SubscriptionPaymentPage } from '../types'

vi.mock('@/features/tenants', () => ({ useActiveTenant: vi.fn() }))
vi.mock('@/components/ui/use-toast', () => ({ useToast: vi.fn() }))
vi.mock('@/features/budgets/hooks/useCategoryOptions', () => ({ useCategoryOptions: vi.fn() }))
vi.mock('@/features/payment-methods/usePaymentMethods', () => {
  const data = [
    { id: 2, name: 'Company card', type: 'CREDIT_CARD', active: true, isDefault: true },
    { id: 3, name: 'Old card', type: 'CREDIT_CARD', active: false, isDefault: false },
  ]
  return { usePaymentMethods: () => ({ data, isPending: false, error: null, refetch: vi.fn() }) }
})

const toastSuccess = vi.fn(() => 1)
const toastError = vi.fn(() => 1)
const clients: QueryClient[] = []

function subscriptionPage(content: Subscription[], filters: SubscriptionFilters) {
  return {
    content, page: filters.page, size: filters.size, totalElements: 21, totalPages: 3,
  }
}

function paymentsPage(): SubscriptionPaymentPage {
  return { content: [payment], page: 0, size: 10, totalElements: 1, totalPages: 1 }
}

function createWrapper(path = '/subscriptions') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></QueryClientProvider>
  }
  return { client, Wrapper }
}

function renderDetails(path: string) {
  const { Wrapper } = createWrapper(path)
  return render(
    <Routes>
      <Route path="/subscriptions/:subscriptionId" element={<SubscriptionDetailsPage />} />
    </Routes>,
    { wrapper: Wrapper },
  )
}

beforeEach(() => {
  vi.mocked(useActiveTenant).mockReturnValue(tenantContext)
  vi.mocked(useToast).mockReturnValue({
    success: toastSuccess, error: toastError, toast: vi.fn(() => 1), info: vi.fn(() => 1), dismiss: vi.fn(),
  })
  vi.mocked(useCategoryOptions).mockReturnValue({
    options: categoryOptions, byId: new Map(categoryOptions.map((item) => [item.id, item])),
    isLoading: false, error: null, refetch: vi.fn(),
  })
  vi.spyOn(subscriptionService, 'list').mockImplementation(async (filters) => subscriptionPage([subscription], filters))
  vi.spyOn(subscriptionService, 'recurringCosts').mockResolvedValue([{ currency: 'USD', monthly: 45, yearly: 540 }])
  vi.spyOn(subscriptionService, 'getById').mockResolvedValue(subscription)
  vi.spyOn(subscriptionService, 'payments').mockResolvedValue(paymentsPage())
  vi.spyOn(subscriptionService, 'pause').mockResolvedValue({ ...subscription, status: 'PAUSED' })
  vi.spyOn(subscriptionService, 'resume').mockResolvedValue(subscription)
  vi.spyOn(subscriptionService, 'stop').mockResolvedValue({ ...subscription, status: 'STOPPED' })
  vi.spyOn(subscriptionService, 'create').mockResolvedValue({ ...subscription, id: 13 })
  vi.spyOn(subscriptionService, 'update').mockResolvedValue(subscription)
})

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('subscription list and lifecycle actions', () => {
  it('shows payment methods between next billing and amount, with a fallback for missing methods', async () => {
    vi.mocked(subscriptionService.list).mockImplementation(async (filters) => subscriptionPage([
      { ...subscription, paymentMethodName: 'Visa' },
      { ...subscription, id: 13, name: 'Hosting', paymentMethod: null, paymentMethodName: null },
    ], filters))
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'Design tools' })
    const table = within(screen.getByRole('table'))
    expect(table.getAllByRole('columnheader').map((header) => header.textContent?.trim()))
      .toEqual(['Name', 'Next billing', 'Payment method', 'Amount', 'Actions'])
    const cells = within(table.getByRole('row', { name: /Design tools/ })).getAllByRole('cell')
    expect(cells[2]).toHaveTextContent('Visa')
    expect(cells[3]).toHaveTextContent('$45.00')
    expect(table.getByText('Not specified')).toBeInTheDocument()
  })

  it('filters both subscriptions and recurring costs by payment method and can clear the selection', async () => {
    const user = userEvent.setup()
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'Design tools' })
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))
    await user.click(screen.getByRole('checkbox', { name: 'Company card (default)' }))
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ paymentMethodId: 2, page: 0 })))
    expect(subscriptionService.recurringCosts).toHaveBeenLastCalledWith(expect.objectContaining({ paymentMethodId: 2 }))
    await user.click(screen.getByRole('checkbox', { name: 'Company card (default)' }))
    expect(screen.getByRole('checkbox', { name: 'Company card (default)' })).not.toBeChecked()
    expect(subscriptionService.list).toHaveBeenCalledWith(expect.objectContaining({ paymentMethodId: undefined, page: 0 }))
  })

  it('combines checkbox selections across groups and clears all filters and search', async () => {
    const user = userEvent.setup()
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'Design tools' })
    const sidebar = within(screen.getByRole('complementary', { name: 'Subscription filters' }))
    expect(sidebar.getByRole('group', { name: 'Categories' })).toBeInTheDocument()
    expect(sidebar.getByRole('group', { name: 'Status' })).toBeInTheDocument()
    expect(sidebar.getByRole('group', { name: 'Payment methods' })).toBeInTheDocument()
    await user.click(sidebar.getByRole('checkbox', { name: 'Active' }))
    await user.click(sidebar.getByRole('checkbox', { name: 'Paused' }))
    await user.click(sidebar.getByRole('checkbox', { name: 'Company card (default)' }))
    await user.click(sidebar.getByRole('checkbox', { name: 'Old card (inactive)' }))
    await user.click(sidebar.getByRole('checkbox', { name: 'Software' }))
    await user.click(sidebar.getByRole('checkbox', { name: 'Travel' }))
    await user.type(sidebar.getByRole('searchbox'), 'Design')
    const selected = {
      search: 'Design', statuses: ['ACTIVE', 'PAUSED'], status: undefined,
      paymentMethodIds: [2, 3], paymentMethodId: undefined, categoryIds: [5, 7],
    }
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ ...selected, page: 0 })))
    expect(subscriptionService.recurringCosts).toHaveBeenLastCalledWith(expect.objectContaining(selected))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))
    await user.click(sidebar.getByRole('checkbox', { name: 'Paused' }))
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ACTIVE', statuses: undefined, page: 0 })))
    await user.click(sidebar.getByRole('button', { name: 'Clear all' }))
    expect(sidebar.getAllByRole('checkbox').every((input) => !(input as HTMLInputElement).checked)).toBe(true)
    expect(sidebar.getByRole('searchbox')).toHaveValue('')
    const cleared = { search: undefined, statuses: undefined, status: undefined, categoryIds: undefined, paymentMethodIds: undefined, paymentMethodId: undefined }
    await waitFor(() => expect(subscriptionService.list).toHaveBeenCalledWith(expect.objectContaining({ ...cleared, page: 0 })))
    expect(subscriptionService.recurringCosts).toHaveBeenCalledWith(expect.objectContaining(cleared))
  })

  it('collapses status and payment-method parent rows without changing selected filters', async () => {
    const user = userEvent.setup()
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'Design tools' })
    const sidebar = within(screen.getByRole('complementary', { name: 'Subscription filters' }))
    expect(sidebar.queryByRole('heading', { name: 'Filters' })).not.toBeInTheDocument()
    expect(sidebar.queryByText('Categories')).not.toBeInTheDocument()
    for (const [group, option] of [['Status', 'Active'], ['Payment methods', 'Company card (default)']]) {
      await user.click(sidebar.getByRole('checkbox', { name: option }))
      const calls = vi.mocked(subscriptionService.list).mock.calls.length
      const costCalls = vi.mocked(subscriptionService.recurringCosts).mock.calls.length
      const collapse = sidebar.getByRole('button', { name: `Collapse ${group}` })
      expect(collapse).toHaveAttribute('aria-expanded', 'true')
      await user.click(collapse)
      expect(sidebar.queryByRole('checkbox', { name: option })).not.toBeInTheDocument()
      const expand = sidebar.getByRole('button', { name: `Expand ${group}` })
      expect(expand).toHaveAttribute('aria-expanded', 'false')
      expand.focus()
      await user.keyboard('{Enter}')
      expect(sidebar.getByRole('checkbox', { name: option })).toBeChecked()
      expect(subscriptionService.list).toHaveBeenCalledTimes(calls)
      expect(subscriptionService.recurringCosts).toHaveBeenCalledTimes(costCalls)
    }
  })

  it('uses the tenant euro currency for list amounts, monthly equivalents, totals and edits despite legacy USD records', async () => {
    const user = userEvent.setup()
    vi.mocked(useActiveTenant).mockReturnValue({
      ...tenantContext, activeTenant: { ...tenantContext.activeTenant, currency: 'EUR', locale: 'de-DE' },
    })
    vi.mocked(subscriptionService.list).mockImplementation(async (filters) =>
      subscriptionPage([{ ...subscription, frequency: 'ANNUAL', amount: 120 }], filters))
    vi.mocked(subscriptionService.recurringCosts).mockResolvedValue([{ currency: 'USD', monthly: 10, yearly: 120 }])
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'Design tools' })
    const table = within(screen.getByRole('table'))
    const euro = (amount: number) => new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(amount)
    expect(table.getByText(euro(120), { collapseWhitespace: false })).toBeInTheDocument()
    expect(table.getByText(`${euro(10)} / month`, { collapseWhitespace: false })).toBeInTheDocument()
    expect(screen.getByLabelText('Recurring subscription costs')).not.toHaveTextContent(/USD|\$/)
    expect(screen.getByRole('table')).not.toHaveTextContent(/\$/)
    await user.click(screen.getByRole('button', { name: 'Edit Design tools' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(subscriptionService.update).toHaveBeenCalledWith(12, expect.objectContaining({ currency: 'EUR', amount: 120 })))
  })

  it('creates subscriptions using the configured tenant currency', async () => {
    const user = userEvent.setup()
    vi.mocked(useActiveTenant).mockReturnValue({
      ...tenantContext, activeTenant: { ...tenantContext.activeTenant, currency: 'EUR' },
    })
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await user.click(screen.getByRole('button', { name: 'New subscription' }))
    const dialog = within(screen.getByRole('dialog'))
    await user.type(dialog.getByLabelText(/Name/), 'Euro subscription')
    await user.click(dialog.getByRole('button', { name: /Category/ }))
    await user.click(dialog.getByRole('treeitem', { name: 'Software' }))
    await user.type(dialog.getByLabelText(/Amount/), '25')
    await user.type(dialog.getByLabelText(/Next billing date/), '2026-11-05')
    await user.click(dialog.getByRole('button', { name: 'Create subscription' }))
    await waitFor(() => expect(subscriptionService.create).toHaveBeenCalledWith(expect.objectContaining({ currency: 'EUR', amount: 25 })))
  })

  it('selects and clears category subtrees for both the list and totals without affecting other branches', async () => {
    const user = userEvent.setup()
    const options = [
      { id: 5, name: 'Software', depth: 0, active: true },
      { id: 8, name: 'Design', depth: 1, parentName: 'Software', active: true },
      { id: 9, name: 'Design tools', depth: 2, parentName: 'Design', active: true },
      { id: 10, name: 'Hosting', depth: 1, parentName: 'Software', active: true },
      { id: 7, name: 'Travel', depth: 0, active: true },
    ]
    vi.mocked(useCategoryOptions).mockReturnValue({
      options, byId: new Map(options.map((option) => [option.id, option])),
      isLoading: false, error: null, refetch: vi.fn(),
    })
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'Design tools' })
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await user.click(screen.getByRole('checkbox', { name: 'Software' }))
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ categoryIds: [5, 8, 9, 10], page: 0 }),
    ))
    expect(subscriptionService.recurringCosts).toHaveBeenLastCalledWith(expect.objectContaining({ categoryIds: [5, 8, 9, 10] }))
    const calls = vi.mocked(subscriptionService.list).mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Collapse Design' }))
    expect(screen.queryByRole('checkbox', { name: 'Design tools' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Hosting' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Collapse Software' }))
    expect(screen.queryByRole('checkbox', { name: 'Design' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Hosting' })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Travel' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Expand Software' }))
    expect(screen.getByRole('checkbox', { name: 'Design' })).toBeChecked()
    expect(screen.queryByRole('checkbox', { name: 'Design tools' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Expand Design' }))
    expect(screen.getByRole('checkbox', { name: 'Design tools' })).toBeChecked()
    expect(subscriptionService.list).toHaveBeenCalledTimes(calls)
    const labels = within(screen.getByRole('list', { name: 'Selected category filters' }))
    expect(labels.getAllByRole('listitem')).toHaveLength(4)
    await user.click(screen.getByRole('checkbox', { name: 'Travel' }))
    await user.click(screen.getByRole('checkbox', { name: 'Design' }))
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ categoryIds: [5, 10, 7] })))
    expect(subscriptionService.recurringCosts).toHaveBeenLastCalledWith(expect.objectContaining({ categoryIds: [5, 10, 7] }))
    expect(screen.getByRole('checkbox', { name: 'Design' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Design tools' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Hosting' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Design' }))
    await user.click(screen.getByRole('checkbox', { name: 'Software' }))
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ categoryIds: [7] })))
    expect(subscriptionService.recurringCosts).toHaveBeenLastCalledWith(expect.objectContaining({ categoryIds: [7] }))
    for (const name of ['Software', 'Design', 'Design tools', 'Hosting']) {
      expect(screen.getByRole('checkbox', { name })).not.toBeChecked()
    }
    expect(screen.getByRole('checkbox', { name: 'Travel' })).toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'Software' }))
    await user.click(screen.getByRole('button', { name: 'Remove Software category filter' }))
    expect(subscriptionService.list).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: [7] }))
    for (const name of ['Software', 'Design', 'Design tools', 'Hosting']) {
      expect(screen.getByRole('checkbox', { name })).not.toBeChecked()
    }
    expect(within(screen.getByRole('list', { name: 'Selected category filters' })).getAllByRole('listitem')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Remove Travel category filter' }))
    await waitFor(() => expect(subscriptionService.list).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: undefined })))
    expect(screen.queryByRole('list', { name: 'Selected category filters' })).not.toBeInTheDocument()
    expect(subscriptionService.recurringCosts).toHaveBeenCalledWith(expect.objectContaining({ categoryIds: undefined }))
  })

  it.each<{ frequency: SubscriptionFrequency; amount: number; monthly: string; customIntervalDays?: number }>([
    { frequency: 'ANNUAL', amount: 120, monthly: '$10.00' },
    { frequency: 'YEARLY', amount: 120, monthly: '$10.00' },
    { frequency: 'QUARTERLY', amount: 60, monthly: '$20.00' },
    { frequency: 'SEMIANNUAL', amount: 180, monthly: '$30.00' },
    { frequency: 'DAILY', amount: 1, monthly: '$30.42' },
    { frequency: 'WEEKLY', amount: 7, monthly: '$30.42' },
    { frequency: 'BIWEEKLY', amount: 14, monthly: '$30.42' },
    { frequency: 'CUSTOM', amount: 90, customIntervalDays: 90, monthly: '$30.42' },
  ])('shows the monthly equivalent below the billed amount for $frequency', async ({ frequency, amount, monthly, customIntervalDays }) => {
    vi.mocked(subscriptionService.list).mockImplementation(async (filters) =>
      subscriptionPage([{ ...subscription, frequency, amount, customIntervalDays }], filters))
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'Design tools' })
    const row = within(screen.getByRole('row', { name: /Design tools/ }))
    const equivalent = row.getByText(`${monthly} / month`)
    expect(equivalent.previousElementSibling).toHaveTextContent(`$${amount.toFixed(2)}`)
  })

  it('does not repeat a monthly equivalent for monthly subscriptions', async () => {
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'Design tools' })
    const row = within(screen.getByRole('row', { name: /Design tools/ }))
    expect(row.getByText('$45.00')).toBeInTheDocument()
    expect(row.queryByText(/\/ month/)).not.toBeInTheDocument()
  })

  it('changes rows per page, resets pagination, and preserves filters and filtered totals', async () => {
    const user = userEvent.setup()
    vi.mocked(subscriptionService.list).mockImplementation(async (filters) => ({
      content: [subscription], page: filters.page, size: filters.size,
      totalElements: 121, totalPages: Math.ceil(121 / filters.size),
    }))
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'Design tools' })
    const selector = screen.getByRole('combobox', { name: 'Rows per page' })
    expect(selector).toHaveValue('10')
    await user.click(screen.getByRole('checkbox', { name: 'Active' }))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('11–20 of 121')).toBeInTheDocument()
    for (const size of [25, 50, 100]) {
      await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), String(size))
      await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 0, size, status: 'ACTIVE' }),
      ))
      expect(await screen.findByText(`1–${size} of 121`)).toBeInTheDocument()
    }
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(await screen.findByText('101–121 of 121')).toBeInTheDocument()
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled()
    expect(subscriptionService.recurringCosts).toHaveBeenCalledTimes(2)
  })

  it('renders independent schedule data and supports server-side filtering, sorting, and pagination', async () => {
    const user = userEvent.setup()
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    expect(await screen.findByRole('link', { name: 'Design tools' })).toHaveAttribute('href', '/subscriptions/12')
    expect(within(screen.getByRole('table')).getByText('$45.00')).toBeInTheDocument()
    expect(within(screen.getByRole('table')).getByText('Monthly')).toBeInTheDocument()
    expect(screen.getByText('Nov 5, 2026')).toBeInTheDocument()
    const table = within(screen.getByRole('table'))
    expect(table.getAllByRole('columnheader')).toHaveLength(5)
    expect(table.getByRole('link', { name: 'Design tools' }).closest('td')).toHaveTextContent('Software')
    expect(table.queryByRole('columnheader', { name: /End date|Status|Reminder|Category/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: 'Filter by frequency' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Next billing from')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Next billing to')).not.toBeInTheDocument()
    expect(table.getByRole('link', { name: 'View Design tools' })).toHaveAttribute('href', '/subscriptions/12')

    await user.click(screen.getByRole('checkbox', { name: 'Active' }))
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'ACTIVE', page: 0 })))
    await user.click(screen.getByRole('checkbox', { name: 'Software' }))
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ categoryIds: [5] })))
    await user.type(screen.getByRole('searchbox', { name: 'Search subscriptions' }), 'Design')
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'Design' })), { timeout: 2000 })
    const appliedFilters = vi.mocked(subscriptionService.list).mock.lastCall?.[0]
    expect(appliedFilters).not.toHaveProperty('frequency')
    expect(appliedFilters).not.toHaveProperty('nextBillingFrom')
    expect(appliedFilters).not.toHaveProperty('nextBillingTo')

    await user.click(screen.getByRole('button', { name: /Next billing/ }))
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ sort: 'nextBillingDate', direction: 'desc' })))
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    await waitFor(() => expect(subscriptionService.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))
  }, 10000)

  it('uses server-provided billing urgency without deriving it from dates', async () => {
    const schedules: Subscription[] = [
      ...[-2, -1, 0, 1, 7, 8]
        .map((days, index) => ({
          ...subscription, id: index + 1, name: `Active ${index}`,
          nextBillingDate: '2099-12-31', overdue: days < 0, daysLeftBeforeDueDate: days,
        })),
      ...(['PAUSED', 'STOPPED', 'ENDED'] as const)
        .map((status, index) => ({ ...subscription, id: index + 7, name: status, status, nextBillingDate: '2026-10-01' })),
    ]
    vi.mocked(subscriptionService.list).mockImplementation(async (filters) => subscriptionPage(schedules, filters))
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'Active 0' })
    const table = within(screen.getByRole('table'))
    expect(table.getAllByText('Overdue')).toHaveLength(2)
    for (const label of ['Due today', '1 day left', '7 days left', '8 days left']) {
      expect(table.getByText(label)).toBeInTheDocument()
    }
    for (const name of ['PAUSED', 'STOPPED', 'ENDED']) {
      const row = table.getByRole('link', { name }).closest('tr')
      expect(row).not.toHaveTextContent(/Overdue|days? left|Due today/)
    }
    expect(screen.queryByLabelText('Subscription statistics')).not.toBeInTheDocument()
    expect(screen.queryByText('Matching subscriptions')).not.toBeInTheDocument()
  })

  it.each([
    { overdue: true, daysLeftBeforeDueDate: 5, label: 'Overdue' },
    { overdue: true, daysLeftBeforeDueDate: null, label: 'Overdue' },
    { overdue: false, daysLeftBeforeDueDate: 1, label: '1 day left' },
    { overdue: false, daysLeftBeforeDueDate: null, label: null },
  ])('respects server urgency $overdue/$daysLeftBeforeDueDate', async ({ overdue, daysLeftBeforeDueDate, label }) => {
    vi.mocked(subscriptionService.list).mockImplementation(async (filters) =>
      subscriptionPage([{ ...subscription, nextBillingDate: '2000-01-01', overdue, daysLeftBeforeDueDate }], filters))
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'Design tools' })
    const row = screen.getByRole('link', { name: 'Design tools' }).closest('tr')
    if (label) expect(row).toHaveTextContent(label)
    else expect(row).not.toHaveTextContent(/Overdue|days? left|Due today/)
  })

  it('updates both cost cards for search, category and status while keeping totals independent of pagination', async () => {
    const user = userEvent.setup()
    vi.mocked(subscriptionService.recurringCosts).mockResolvedValueOnce([
      { currency: 'EUR', monthly: 20, yearly: 240 },
      { currency: 'USD', monthly: 100, yearly: 1200 },
    ]).mockResolvedValue([{ currency: 'USD', monthly: 25, yearly: 300 }])
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    const costs = within(screen.getByLabelText('Recurring subscription costs'))
    expect(await costs.findByText('$120.00')).toBeInTheDocument()
    expect(costs.getByText('$1,440.00')).toBeInTheDocument()
    const monthlyCard = costs.getByText('Monthly equivalent').parentElement
    const yearlyCard = costs.getByText('Yearly equivalent').parentElement
    expect(monthlyCard).not.toBe(yearlyCard)
    expect(monthlyCard).toHaveClass('border')
    expect(yearlyCard).toHaveClass('border')
    expect(within(monthlyCard as HTMLElement).getByText('$120.00')).toBeInTheDocument()
    expect(within(yearlyCard as HTMLElement).getByText('$1,440.00')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: 'Paused' }))
    expect(await costs.findByText('$25.00')).toBeInTheDocument()
    expect(costs.getByText('$300.00')).toBeInTheDocument()
    expect(costs.queryByText('$120.00')).not.toBeInTheDocument()
    expect(subscriptionService.recurringCosts).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'PAUSED', search: undefined, categoryIds: undefined }))
    await user.click(screen.getByRole('checkbox', { name: 'Software' }))
    await waitFor(() => expect(subscriptionService.recurringCosts).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'PAUSED', search: undefined, categoryIds: [5] })))
    await user.type(screen.getByRole('searchbox', { name: 'Search subscriptions' }), 'Design')
    await waitFor(() => expect(subscriptionService.recurringCosts).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'PAUSED', search: 'Design', categoryIds: [5] })))
    const callsBeforePagination = vi.mocked(subscriptionService.recurringCosts).mock.calls.length
    await user.click(screen.getByRole('button', { name: 'Next page' }))
    expect(costs.getByText('$25.00')).toBeInTheDocument()
    expect(subscriptionService.recurringCosts).toHaveBeenCalledTimes(callsBeforePagination)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '25')
    await user.click(screen.getByRole('button', { name: /Next billing/ }))
    expect(subscriptionService.recurringCosts).toHaveBeenCalledTimes(callsBeforePagination)
  })

  it('shows zero cost for an empty workspace and exposes retryable cost errors without partial totals', async () => {
    const user = userEvent.setup()
    vi.mocked(subscriptionService.recurringCosts)
      .mockRejectedValueOnce(new Error('Totals unavailable'))
      .mockResolvedValueOnce([])
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    const costs = within(screen.getByLabelText('Recurring subscription costs'))
    expect(await costs.findByRole('alert')).toHaveTextContent('Totals unavailable')
    expect(costs.getAllByText('—')).toHaveLength(2)
    await user.click(costs.getByRole('button', { name: 'Retry recurring costs' }))
    await waitFor(() => expect(costs.getAllByText('$0.00')).toHaveLength(2))
  })

  it('edits a subscription from the list and refreshes recurring costs', async () => {
    const user = userEvent.setup()
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await user.click(await screen.findByRole('button', { name: 'Edit Design tools' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(dialog.getByLabelText(/Name/)).toHaveValue('Design tools')
    expect(dialog.getByLabelText(/Amount/)).toHaveValue(45)
    await user.clear(dialog.getByLabelText(/Name/))
    await user.type(dialog.getByLabelText(/Name/), 'Updated tools')
    await user.click(dialog.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(subscriptionService.update).toHaveBeenCalledWith(12, expect.objectContaining({ name: 'Updated tools' })))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(toastSuccess).toHaveBeenCalledWith('Subscription updated', expect.any(String))
    await waitFor(() => expect(subscriptionService.recurringCosts).toHaveBeenCalledTimes(2))
  })

  it('creates a subscription and navigates to its detail page', async () => {
    const user = userEvent.setup()
    const { Wrapper } = createWrapper()
    render(<Routes>
      <Route path="/subscriptions" element={<SubscriptionsPage />} />
      <Route path="/subscriptions/:subscriptionId" element={<SubscriptionDetailsPage />} />
    </Routes>, { wrapper: Wrapper })
    await user.click(await screen.findByRole('button', { name: 'New subscription' }))
    const dialog = screen.getByRole('dialog')
    await user.type(within(dialog).getByLabelText(/Name/), 'Design tools')
    await user.click(within(dialog).getByRole('button', { name: /Category/ }))
    await user.click(within(dialog).getByRole('treeitem', { name: 'Software' }))
    await user.type(within(dialog).getByLabelText(/Amount/), '45')
    await user.type(within(dialog).getByLabelText(/Next billing date/), '2026-11-05')
    await user.click(within(dialog).getByRole('button', { name: 'Create subscription' }))
    expect(await screen.findByRole('heading', { name: 'Design tools' })).toBeInTheDocument()
    expect(subscriptionService.create).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Design tools', categoryId: 5, amount: 45, frequency: 'MONTHLY', nextBillingDate: '2026-11-05',
    }))
    expect(toastSuccess).toHaveBeenCalledWith('Subscription created', expect.any(String))
  })

  it('shows empty and retryable error states without inventing subscriptions', async () => {
    vi.mocked(subscriptionService.list).mockResolvedValueOnce({
      content: [], page: 0, size: 10, totalElements: 0, totalPages: 0,
    })
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    expect(await screen.findByText('No subscriptions yet')).toBeInTheDocument()
    vi.mocked(subscriptionService.list).mockRejectedValueOnce(new Error('Service unavailable'))
    const retry = screen.getByRole('button', { name: 'Refresh subscriptions' })
    await userEvent.click(retry)
    expect(await screen.findByText('Could not load subscriptions')).toBeInTheDocument()
    expect(screen.getByText('Service unavailable')).toBeInTheDocument()
    expect(screen.queryByLabelText('Subscription statistics')).not.toBeInTheDocument()
  })

  it.each(['ACTIVE', 'PAUSED', 'STOPPED', 'ENDED'] as const)('shows only view and permitted edit actions for %s subscriptions', async (status) => {
    vi.mocked(subscriptionService.list).mockImplementation(async (filters) =>
      subscriptionPage([{ ...subscription, status }], filters))
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'View Design tools' })
    const row = within(screen.getByRole('row', { name: /Design tools/ }))
    expect(row.queryByRole('button', { name: /Pause|Resume|Stop/ })).not.toBeInTheDocument()
    if (status === 'ACTIVE' || status === 'PAUSED') {
      expect(row.getByRole('button', { name: 'Edit Design tools' })).toBeInTheDocument()
    } else {
      expect(row.queryByRole('button')).not.toBeInTheDocument()
    }
  })

  it('keeps the edit dialog open and exposes update errors', async () => {
    const user = userEvent.setup()
    vi.mocked(subscriptionService.update).mockRejectedValueOnce(new Error('Conflict: billing is processing'))
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await user.click(await screen.findByRole('button', { name: 'Edit Design tools' }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await within(screen.getByRole('dialog')).findByRole('alert')).toHaveTextContent('Conflict: billing is processing')
    expect(toastError).toHaveBeenCalledWith('Could not update subscription', expect.any(String))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('hides edit actions from viewers while retaining view access', async () => {
    vi.mocked(useActiveTenant).mockReturnValue({ ...tenantContext, canEdit: false, currentRole: 'VIEWER' })
    const { Wrapper } = createWrapper()
    render(<SubscriptionsPage />, { wrapper: Wrapper })
    await screen.findByRole('link', { name: 'Design tools' })
    expect(screen.queryByRole('button', { name: 'New subscription' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Design tools' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View Design tools' })).toHaveAttribute('href', '/subscriptions/12')
  })
})

describe('subscription details and payments', () => {
  it('shows subscription details and a paginated generated-expense history', async () => {
    renderDetails('/subscriptions/12')
    expect(await screen.findByRole('heading', { name: 'Design tools' })).toBeInTheDocument()
    expect(screen.getByText('This schedule is separate from payments and expense totals.')).toBeInTheDocument()
    expect(await screen.findByText('#902')).toBeInTheDocument()
    expect(screen.getByText('PENDING')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '#902' })).toHaveAttribute('href', '/expenses/902')
    expect(subscriptionService.payments).toHaveBeenCalledWith(12, {
      page: 0, size: 10, sort: 'scheduledBillingDate', direction: 'desc',
    })
  })

  it('edits future schedule details and pauses/resumes/stops in the detail view', async () => {
    const user = userEvent.setup()
    renderDetails('/subscriptions/12')
    await user.click(await screen.findByRole('button', { name: 'Edit' }))
    const dialog = screen.getByRole('dialog')
    await user.clear(within(dialog).getByLabelText(/Name/))
    await user.type(within(dialog).getByLabelText(/Name/), 'Design platform')
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(subscriptionService.update).toHaveBeenCalledWith(12, expect.objectContaining({ name: 'Design platform' })))
    expect(toastSuccess).toHaveBeenCalledWith('Subscription updated', expect.any(String))

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(subscriptionService.pause).toHaveBeenCalledWith(12)
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    await user.click(screen.getByRole('button', { name: 'Stop Design tools' }))
    expect(subscriptionService.stop).toHaveBeenCalledWith(12)
  })

  it('paginates payment history and retries payment errors', async () => {
    const user = userEvent.setup()
    vi.mocked(subscriptionService.payments)
      .mockResolvedValueOnce({ ...paymentsPage(), totalPages: 2 })
      .mockRejectedValueOnce(new Error('History unavailable'))
    renderDetails('/subscriptions/12')
    await screen.findByText('#902')
    await user.click(screen.getByRole('button', { name: 'Next history page' }))
    expect(await screen.findByText('History unavailable')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry history' }))
    await waitFor(() => expect(subscriptionService.payments).toHaveBeenCalledWith(12, expect.objectContaining({ page: 1 })))
  })

  it('handles invalid and missing subscriptions', async () => {
    renderDetails('/subscriptions/not-an-id')
    expect(screen.getByRole('heading', { name: 'Subscription not found' })).toBeInTheDocument()
    expect(subscriptionService.getById).not.toHaveBeenCalled()
    expect(subscriptionService.payments).not.toHaveBeenCalled()
  })
})
