import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient, ApiClientError } from '@/api/client'
import { fetchDashboardSummary } from '../services/dashboardService'
import { DashboardPage } from '../pages/DashboardPage'
import type { DashboardSummary } from '../types'

vi.mock('@/features/tenants', () => ({
  useActiveTenant: () => ({
    activeTenant: { id: 7, name: 'Acme', currency: 'USD', locale: 'en-US' },
    canEdit: false,
  }),
}))
vi.mock('@/features/budgets', () => ({ BudgetConsumptionWidget: () => null }))
vi.mock('../components/SpendingTrendChart', () => ({ SpendingTrendChart: () => null }))

const summary: DashboardSummary = {
  monthExpenses: { currentTotal: 1200, previousTotal: 1000, percentageChange: 20 },
  yearExpenses: { currentTotal: 9000, previousTotal: 10000, percentageChange: -10 },
  upcomingThisMonth: { totalAmount: 450.5, count: 3, nextExpenseLabel: 'Rent · Oct 30' },
  overdue: { totalAmount: 75, count: 2 },
  pending: { totalAmount: 300, count: 4 },
  monthlyBudget: { totalBudget: 5000, usedPercentage: 62.4, totalRemaining: 1880 },
}

let client: QueryClient
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
})

function renderPage() {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('fetchDashboardSummary', () => {
  it('calls the summary endpoint with tenant and signal', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(summary)
    const signal = new AbortController().signal
    expect(await fetchDashboardSummary(7, signal)).toEqual(summary)
    expect(get).toHaveBeenCalledWith('/v1/dashboard/summary', { tenantId: 7, signal })
  })

  it('normalizes a missing nextExpenseLabel to null and rejects invalid payloads', async () => {
    const { nextExpenseLabel: _omit, ...upcoming } = summary.upcomingThisMonth
    vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ ...summary, upcomingThisMonth: upcoming })
      .mockResolvedValueOnce({ monthExpenses: {} })
    expect((await fetchDashboardSummary(7)).upcomingThisMonth.nextExpenseLabel).toBeNull()
    await expect(fetchDashboardSummary(7)).rejects.toThrow(/invalid dashboard summary/i)
  })
})

describe('DashboardPage summary', () => {
  it('loads the summary on init and maps all six cards', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(summary)
    renderPage()

    await screen.findByText('$1,200.00')
    expect(screen.getByTestId('month-current-total')).toHaveTextContent('$1,200.00')
    expect(screen.getByTestId('month-comparison')).toHaveTextContent('+20.0%')
    expect(screen.getByTestId('month-comparison')).toHaveTextContent('+$200.00 vs last month ($1,000.00)')
    expect(screen.getByTestId('year-current-total')).toHaveTextContent('$9,000.00')
    expect(screen.getByTestId('year-comparison')).toHaveTextContent('-10.0%')
    expect(screen.getByTestId('year-comparison')).toHaveTextContent('($10,000.00)')
    expect(screen.getByTestId('upcoming-total')).toHaveTextContent('$450.50')
    expect(screen.getByText('3 scheduled')).toBeInTheDocument()
    expect(screen.getByTestId('upcoming-next')).toHaveTextContent('Next: Rent · Oct 30')
    expect(screen.getByTestId('overdue-total')).toHaveTextContent('$75.00')
    expect(screen.getByTestId('overdue-count')).toHaveTextContent('2 overdue')
    expect(screen.getByTestId('pending-total')).toHaveTextContent('$300.00')
    expect(screen.getByTestId('pending-count')).toHaveTextContent('4 pending')
    expect(screen.getByTestId('budget-total')).toHaveTextContent('$5,000.00')
    expect(screen.getByTestId('budget-used')).toHaveTextContent('62% used')
    expect(screen.getByTestId('budget-remaining')).toHaveTextContent('$1,880.00')
  })

  it('shows a fallback when nextExpenseLabel is null', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      ...summary,
      upcomingThisMonth: { ...summary.upcomingThisMonth, nextExpenseLabel: null },
    })
    renderPage()
    await screen.findByText('3 scheduled')
    expect(screen.getByTestId('upcoming-next')).toHaveTextContent('Next: —')
  })

  it('refreshes once, disables the button while loading, and ignores repeat clicks', async () => {
    let resolveRefresh: (value: DashboardSummary) => void = () => {}
    const get = vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce(summary)
      .mockImplementationOnce(() => new Promise((resolve) => { resolveRefresh = resolve }))
    renderPage()
    await screen.findByText('$1,200.00')

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^refresh$/i }))
    const busy = await screen.findByRole('button', { name: /refreshing/i })
    expect(busy).toBeDisabled()
    await user.click(busy)
    expect(get).toHaveBeenCalledTimes(2)

    resolveRefresh({ ...summary, monthExpenses: { ...summary.monthExpenses, currentTotal: 1500 } })
    expect(await screen.findByText('$1,500.00')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^refresh$/i })).toBeEnabled()
  })

  it('shows a non-blocking error with retry that reloads the summary', async () => {
    const get = vi.spyOn(apiClient, 'get')
      .mockRejectedValueOnce(new ApiClientError('Request failed with status 500', 500))
      .mockResolvedValueOnce(summary)
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i)
    expect(screen.getByTestId('month-current-total')).toHaveTextContent('—')

    await userEvent.setup().click(screen.getByRole('button', { name: /retry/i }))
    expect(await screen.findByText('$1,200.00')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())
    expect(get).toHaveBeenCalledTimes(2)
  })
})
