import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient, ApiClientError } from '@/api/client'
import { fetchDashboardSummary } from '../services/dashboardService'
import { DashboardPage } from '../pages/DashboardPage'
import type { DashboardSummary } from '../types'
import { expenseService } from '@/features/expenses'
import { expenseStatistics } from '@/features/expenses/__tests__/expenseFixtures'

vi.mock('@/features/tenants', () => ({
  useActiveTenant: () => ({
    activeTenant: { id: 7, name: 'Acme', currency: 'USD', locale: 'en-US' },
    canEdit: false,
  }),
}))
vi.mock('@/features/budgets', () => ({
  BudgetConsumptionWidget: () => <div data-testid="budgets-widget" />,
}))
vi.mock('../components/SpendingTrendChart', () => ({
  SpendingTrendChart: () => <div data-testid="trends-widget" />,
}))

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
  vi.spyOn(expenseService, 'statistics').mockResolvedValue(expenseStatistics)
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
    expect(expenseService.statistics).toHaveBeenCalledTimes(2)

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

describe('DashboardPage category spending', () => {
  it('uses the statistics endpoint for month-to-date and shows only root totals', async () => {
    vi.mocked(expenseService.statistics).mockRestore()
    const get = vi.spyOn(apiClient, 'get').mockImplementation(async (endpoint) =>
      endpoint === '/v1/expenses/statistics' ? expenseStatistics : summary,
    )
    const today = new Date()
    const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    renderPage()

    expect(await screen.findByText('Utilities')).toBeInTheDocument()
    expect(screen.getByText('49.6%')).toBeInTheDocument()
    expect(screen.getByText('$935.00')).toBeInTheDocument()
    expect(screen.getByText('3 spending categories')).toBeInTheDocument()
    expect(screen.queryByText('Groceries')).not.toBeInTheDocument()
    expect(get).toHaveBeenCalledWith('/v1/expenses/statistics', {
      params: {
        startDate: `${yearMonth}-01`,
        endDate: `${yearMonth}-${String(today.getDate()).padStart(2, '0')}`,
      },
    })
  })

  it('shows loading instead of demo category amounts', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(summary)
    vi.mocked(expenseService.statistics).mockReturnValue(new Promise(() => {}))
    renderPage()

    expect(screen.getByRole('status')).toHaveTextContent('Loading category spending...')
    expect(screen.queryByText(/spending categories$/)).not.toBeInTheDocument()
    await screen.findByText('$1,200.00')
  })

  it('shows an empty state and excludes zero-spending categories', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(summary)
    vi.mocked(expenseService.statistics).mockResolvedValue({
      ...expenseStatistics,
      totalExpenses: 0,
      byCategory: [{ categoryId: 1, categoryName: 'Unused category', total: 0, parentTotal: null, subCategories: [] }],
    })
    renderPage()

    expect(await screen.findByText('No category expenses this month.')).toBeInTheDocument()
    expect(screen.getByText('0 spending categories')).toBeInTheDocument()
    expect(screen.queryByText('Unused category')).not.toBeInTheDocument()
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument()
  })

  it('retries category failures without blocking the dashboard summary', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(summary)
    vi.mocked(expenseService.statistics)
      .mockRejectedValueOnce(new Error('Category request failed'))
      .mockResolvedValueOnce(expenseStatistics)
    renderPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Category request failed')
    expect(screen.getByTestId('month-current-total')).toHaveTextContent('$1,200.00')
    await userEvent.setup().click(screen.getByRole('button', { name: 'Retry category spending' }))
    expect(await screen.findByText('3 spending categories')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps loaded category amounts visible when a refresh fails', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(summary)
    vi.mocked(expenseService.statistics)
      .mockResolvedValueOnce(expenseStatistics)
      .mockRejectedValueOnce(new Error('Category refresh failed'))
    renderPage()

    await screen.findByText('3 spending categories')
    await userEvent.setup().click(screen.getByRole('button', { name: /^refresh$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent('showing last loaded values')
    expect(screen.getByText('$935.00')).toBeInTheDocument()
  })

  it('caps category rows to top 4 with an Other summary and expands on demand', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(summary)
    vi.mocked(expenseService.statistics).mockResolvedValue({
      ...expenseStatistics,
      totalExpenses: 1000,
      byCategory: [
        { categoryId: 1, categoryName: 'Housing', total: 400, parentTotal: null, subCategories: [] },
        { categoryId: 2, categoryName: 'Utilities', total: 250, parentTotal: null, subCategories: [] },
        { categoryId: 3, categoryName: 'Food', total: 150, parentTotal: null, subCategories: [] },
        { categoryId: 4, categoryName: 'Software', total: 100, parentTotal: null, subCategories: [] },
        { categoryId: 5, categoryName: 'Travel', total: 60, parentTotal: null, subCategories: [] },
        { categoryId: 6, categoryName: 'Office', total: 40, parentTotal: null, subCategories: [] },
      ],
    })
    renderPage()

    expect(await screen.findByText('Housing')).toBeInTheDocument()
    expect(screen.getByText('Other (2)')).toBeInTheDocument()
    expect(screen.queryByText('Travel')).not.toBeInTheDocument()
    expect(screen.getByText('6 spending categories')).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /show all 6 categories/i }))
    expect(screen.getByText('Travel')).toBeInTheDocument()
    expect(screen.getByText('Office')).toBeInTheDocument()
    expect(screen.queryByText('Other (2)')).not.toBeInTheDocument()
  })
})

describe('DashboardPage compact mobile layout', () => {
  it('replaces stacked widgets with a segmented tab switcher on small screens', async () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(max-width: 1023px)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    try {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        ...summary,
        overdue: { totalAmount: 0, count: 0 },
      })
      renderPage()

      await screen.findByText('$1,200.00')
      expect(screen.getByTestId('overdue-count')).toHaveTextContent('All settled')

      // Only the active mobile section is mounted at a time
      expect(screen.getByRole('tablist', { name: 'Dashboard sections' })).toBeInTheDocument()
      expect(screen.getByTestId('trends-widget')).toBeInTheDocument()
      expect(screen.queryByText('Utilities')).not.toBeInTheDocument()
      expect(screen.queryByTestId('budgets-widget')).not.toBeInTheDocument()

      const user = userEvent.setup()
      await user.click(screen.getByRole('tab', { name: /categories/i }))
      expect(await screen.findByText('Utilities')).toBeInTheDocument()
      expect(screen.queryByTestId('trends-widget')).not.toBeInTheDocument()

      await user.click(screen.getByRole('tab', { name: /budgets/i }))
      expect(screen.getByTestId('budgets-widget')).toBeInTheDocument()
      expect(screen.queryByText('Utilities')).not.toBeInTheDocument()
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })
})
