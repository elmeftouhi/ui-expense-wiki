import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiClientError } from '@/api/client'
import { queryKeys } from '@/api/query-keys'
import { useActiveTenant } from '@/features/tenants'
import { useToast } from '@/components/ui/use-toast'
import { BudgetsPage } from '../pages/BudgetsPage'
import { BudgetDetailsPage } from '../pages/BudgetDetailsPage'
import { BudgetConsumptionWidget } from '../components/BudgetConsumptionWidget'
import { useBudget, useUpdateBudgetPeriod } from '../hooks/useBudgets'
import { useCategoryOptions } from '../hooks/useCategoryOptions'
import { budgetService } from '../services/budgetService'
import { budget, categoryOptions, period, tenantContext } from './fixtures'

vi.mock('@/features/tenants', () => ({ useActiveTenant: vi.fn() }))
vi.mock('@/components/ui/use-toast', () => ({ useToast: vi.fn() }))
vi.mock('../hooks/useCategoryOptions', () => ({ useCategoryOptions: vi.fn() }))

const successToast = vi.fn(() => 1)
const errorToast = vi.fn(() => 1)
const clients: QueryClient[] = []

function createWrapper(path = '/budgets') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></QueryClientProvider>
  }
  return { client, Wrapper }
}

beforeEach(() => {
  vi.mocked(useActiveTenant).mockReturnValue(tenantContext)
  vi.mocked(useToast).mockReturnValue({
    success: successToast, error: errorToast, toast: vi.fn(() => 1), info: vi.fn(() => 1), dismiss: vi.fn(),
  })
  vi.mocked(useCategoryOptions).mockReturnValue({
    options: categoryOptions, byId: new Map(categoryOptions.map((option) => [option.id, option])),
    isLoading: false, error: null, refetch: vi.fn(),
  })
  vi.spyOn(budgetService, 'getAll').mockResolvedValue([budget])
  vi.spyOn(budgetService, 'getById').mockResolvedValue(budget)
  vi.spyOn(budgetService, 'getPeriods').mockResolvedValue([period])
  vi.spyOn(budgetService, 'getHistory').mockResolvedValue([])
})

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

describe('budget pages', () => {
  it('switches views, filters budgets and navigates to details and history', async () => {
    const user = userEvent.setup()
    const { Wrapper } = createWrapper()
    render(<Routes>
      <Route path="/budgets" element={<BudgetsPage />} />
      <Route path="/budgets/:budgetId" element={<BudgetDetailsPage />} />
    </Routes>, { wrapper: Wrapper })
    expect(await screen.findByTestId('budget-card-1')).toHaveTextContent('$150.00')
    await user.click(screen.getByRole('button', { name: 'Table view' }))
    expect(screen.getByRole('table')).toHaveTextContent('OPEN')
    await user.type(screen.getByRole('searchbox', { name: 'Search budgets' }), 'missing')
    expect(screen.getByText('No budgets match your filters')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    await user.click(screen.getByRole('link', { name: 'Cloud services' }))
    expect(await screen.findByRole('heading', { name: 'Cloud services' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Adjust period October 2026' })).toBeInTheDocument()
  })

  it('sorts active budgets by urgency first and supports 1-tap overview filtering and card tap navigation', async () => {
    const user = userEvent.setup()
    const onTrackBudget = {
      ...budget,
      id: 1,
      name: 'Alpha software',
      currentPeriod: { ...period, id: 11, spentAmount: 200 },
    }
    const exceededBudget = {
      ...budget,
      id: 2,
      name: 'Zeta hosting',
      currentPeriod: { ...period, id: 12, spentAmount: 1250 },
    }
    const inactiveBudget = {
      ...budget,
      id: 3,
      name: 'Beta archived',
      active: false,
      currentPeriod: { ...period, id: 13, spentAmount: 1300 },
    }
    vi.mocked(budgetService.getAll).mockResolvedValue([onTrackBudget, inactiveBudget, exceededBudget])
    vi.mocked(budgetService.getById).mockResolvedValue(exceededBudget)

    const { Wrapper } = createWrapper()
    render(
      <Routes>
        <Route path="/budgets" element={<BudgetsPage />} />
        <Route path="/budgets/:budgetId" element={<BudgetDetailsPage />} />
      </Routes>,
      { wrapper: Wrapper },
    )

    await screen.findByTestId('budget-card-2')
    const cards = screen.getAllByTestId(/budget-card-/)
    expect(cards.map((el) => el.getAttribute('data-testid'))).toEqual([
      'budget-card-2',
      'budget-card-1',
      'budget-card-3',
    ])
    expect(screen.getByTestId('budget-card-2')).toHaveTextContent('$250.00')
    expect(screen.getByTestId('budget-card-2')).toHaveTextContent('over')

    const overview = screen.getByRole('region', { name: 'Budgets overview' })
    await user.click(within(overview).getByRole('button', { name: /Exceeded/i }))
    expect(screen.queryByTestId('budget-card-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('budget-card-2')).toBeInTheDocument()

    // Clicking the card body navigates to budget details
    await user.click(screen.getByTestId('budget-card-2'))
    expect(await screen.findByRole('heading', { name: 'Zeta hosting' })).toBeInTheDocument()
  })

  it('hides the desktop table switcher on small screens', async () => {
    const originalMatchMedia = window.matchMedia
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    try {
      const { Wrapper } = createWrapper()
      render(<BudgetsPage />, { wrapper: Wrapper })
      expect(await screen.findByTestId('budget-card-1')).toBeInTheDocument()
      expect(screen.queryByRole('group', { name: 'View mode' })).not.toBeInTheDocument()
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })

  it('creates a budget, refreshes the list and emits a success toast', async () => {
    const user = userEvent.setup()
    const created = { ...budget, id: 2, name: 'New cap', description: undefined, currentPeriod: null }
    vi.spyOn(budgetService, 'create').mockResolvedValue(created)
    vi.mocked(budgetService.getAll).mockResolvedValueOnce([]).mockResolvedValue([created])
    const { Wrapper } = createWrapper()
    render(<BudgetsPage />, { wrapper: Wrapper })
    await screen.findByText('No budgets yet')
    await user.click(screen.getByRole('button', { name: 'New budget' }))
    await user.type(screen.getByLabelText(/Budget name/), 'New cap')
    await user.type(screen.getByLabelText(/Allocated amount/), '1000')
    await user.click(screen.getByRole('option', { name: 'Software' }))
    await user.click(screen.getByRole('button', { name: 'Create budget' }))
    expect(await screen.findByTestId('budget-card-2')).toHaveTextContent('No current period yet')
    expect(budgetService.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'New cap', categoryIds: [1] }))
    expect(successToast).toHaveBeenCalledWith('Budget created', expect.any(String))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows list errors and supports retry instead of displaying an empty success state', async () => {
    vi.mocked(budgetService.getAll).mockRejectedValueOnce(new Error('Network unavailable'))
    const { Wrapper } = createWrapper()
    render(<BudgetsPage />, { wrapper: Wrapper })
    expect(await screen.findByText('Network unavailable')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByTestId('budget-card-1')).toBeInTheDocument()
  })

  it('hides all mutation actions from viewers', async () => {
    vi.mocked(useActiveTenant).mockReturnValue({ ...tenantContext, canEdit: false, currentRole: 'VIEWER' })
    const { Wrapper } = createWrapper('/budgets/1')
    render(<Routes><Route path="/budgets/:budgetId" element={<BudgetDetailsPage />} /></Routes>, { wrapper: Wrapper })
    await screen.findByRole('heading', { name: 'Cloud services' })
    expect(screen.queryByRole('button', { name: /Edit budget|Adjust/ })).not.toBeInTheDocument()
  })

  it('displays missing budgets and does not request invalid route ids', async () => {
    const { Wrapper } = createWrapper('/budgets/not-an-id')
    render(<Routes><Route path="/budgets/:budgetId" element={<BudgetDetailsPage />} /></Routes>, { wrapper: Wrapper })
    expect(screen.getByRole('heading', { name: 'Budget not found' })).toBeInTheDocument()
    expect(budgetService.getById).not.toHaveBeenCalled()
    expect(budgetService.getPeriods).not.toHaveBeenCalled()
  })

  it('loads the month history on the details page with the default range', async () => {
    vi.mocked(budgetService.getHistory).mockResolvedValue([period])
    const { Wrapper } = createWrapper('/budgets/1')
    render(<Routes><Route path="/budgets/:budgetId" element={<BudgetDetailsPage />} /></Routes>, { wrapper: Wrapper })
    const table = await screen.findByRole('table', { name: 'Budget history' })
    expect(table).toHaveTextContent('Oct 2026')
    expect(budgetService.getHistory).toHaveBeenCalledWith(1, 12)
    expect(screen.getByText('Spent (paid)')).toBeInTheDocument()
  })

  it('handles a server-side 404', async () => {
    vi.mocked(budgetService.getById).mockRejectedValue(new ApiClientError('Not found', 404))
    const { Wrapper } = createWrapper('/budgets/1')
    render(<Routes><Route path="/budgets/:budgetId" element={<BudgetDetailsPage />} /></Routes>, { wrapper: Wrapper })
    expect(await screen.findByRole('heading', { name: 'Budget not found' })).toBeInTheDocument()
  })

  it('drops open forms and filters when the active tenant changes', async () => {
    const user = userEvent.setup()
    const { Wrapper } = createWrapper()
    const { rerender } = render(<BudgetsPage />, { wrapper: Wrapper })
    await screen.findByTestId('budget-card-1')
    await user.type(screen.getByRole('searchbox', { name: 'Search budgets' }), 'Cloud')
    await user.click(screen.getByRole('button', { name: 'New budget' }))
    await user.type(screen.getByLabelText(/Budget name/), 'Unsaved old workspace budget')
    vi.mocked(useActiveTenant).mockReturnValue({
      ...tenantContext, activeTenant: { ...tenantContext.activeTenant, id: 202 },
    })
    rerender(<BudgetsPage />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Search budgets' })).toHaveValue('')
  })

  it('shows live budget data on the dashboard widget', async () => {
    const { Wrapper } = createWrapper()
    render(<BudgetConsumptionWidget currency="USD" locale="en-US" />, { wrapper: Wrapper })
    expect(screen.getByRole('status')).toHaveTextContent('Loading budgets')
    const link = await screen.findByRole('link', { name: 'Cloud services' })
    expect(link).toHaveAttribute('href', '/budgets/1')
    expect(screen.getByText('$850.00 of $1,000.00')).toBeInTheDocument()
  })

  it('updates a period through the details dialog and refreshes the current summary', async () => {
    const user = userEvent.setup()
    const updatedPeriod = { ...period, allocatedAmount: 1200 }
    vi.spyOn(budgetService, 'updatePeriod').mockResolvedValue(updatedPeriod)
    const { Wrapper } = createWrapper('/budgets/1')
    render(<Routes><Route path="/budgets/:budgetId" element={<BudgetDetailsPage />} /></Routes>, { wrapper: Wrapper })
    await user.click(await screen.findByRole('button', { name: 'Adjust current period' }))
    const dialog = screen.getByRole('dialog')
    await user.clear(within(dialog).getByLabelText(/Allocated amount/))
    await user.type(within(dialog).getByLabelText(/Allocated amount/), '1200')
    vi.mocked(budgetService.getById).mockResolvedValue({ ...budget, currentPeriod: updatedPeriod })
    vi.mocked(budgetService.getPeriods).mockResolvedValue([updatedPeriod])
    await user.click(within(dialog).getByRole('button', { name: 'Save period' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(budgetService.updatePeriod).toHaveBeenCalledWith(1, 10, {
      allocatedAmount: 1200, warningType: 'PERCENTAGE', warningThreshold: 80,
    })
    await waitFor(() => expect(screen.getAllByText('$350.00')).toHaveLength(2))
    expect(successToast).toHaveBeenCalledWith('Period updated', expect.any(String))
  })

  it('saves budget edits and replaces the cached detail values', async () => {
    const user = userEvent.setup()
    const updated = { ...budget, name: 'Infrastructure cap', categoryIds: [1, 2] }
    vi.spyOn(budgetService, 'update').mockResolvedValue(updated)
    const { Wrapper } = createWrapper('/budgets/1')
    render(<Routes><Route path="/budgets/:budgetId" element={<BudgetDetailsPage />} /></Routes>, { wrapper: Wrapper })
    await user.click(await screen.findByRole('button', { name: 'Edit budget' }))
    await user.clear(screen.getByLabelText(/Budget name/))
    await user.type(screen.getByLabelText(/Budget name/), 'Infrastructure cap')
    await user.click(screen.getByRole('option', { name: 'Hosting' }))
    vi.mocked(budgetService.getById).mockResolvedValue(updated)
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('heading', { name: 'Infrastructure cap' })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(budgetService.update).toHaveBeenCalledWith(1, {
      name: 'Infrastructure cap', description: 'Infrastructure costs', categoryIds: [1, 2],
      periodicity: 'MONTHLY', allocatedAmount: 1000, warningType: 'PERCENTAGE', warningThreshold: 80, active: true,
    })
    expect(successToast).toHaveBeenCalledWith('Budget updated', expect.any(String))
  })
})

describe('budget query isolation', () => {
  it('uses tenant-scoped keys and disables invalid ids', async () => {
    const { Wrapper, client } = createWrapper()
    const { result, rerender } = renderHook(({ id }) => useBudget(id), { initialProps: { id: 0 }, wrapper: Wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(budgetService.getById).not.toHaveBeenCalled()
    rerender({ id: 1 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(client.getQueryData(queryKeys.tenantScope(101).budgets.detail(1))).toEqual(budget)
    expect(client.getQueryData(queryKeys.tenantScope(202).budgets.detail(1))).toBeUndefined()
  })

  it('invalidates list, details and history after adjusting a period', async () => {
    const { Wrapper, client } = createWrapper()
    const keys = queryKeys.tenantScope(101).budgets
    client.setQueryData(keys.list(), [budget])
    client.setQueryData(keys.detail(1), budget)
    client.setQueryData(keys.periods(1), [period])
    const updated = { ...period, allocatedAmount: 1200 }
    vi.spyOn(budgetService, 'updatePeriod').mockResolvedValue(updated)
    const { result } = renderHook(() => useUpdateBudgetPeriod(1), { wrapper: Wrapper })
    await act(() => result.current.mutateAsync({
      periodId: 10, payload: { allocatedAmount: 1200, warningType: 'PERCENTAGE', warningThreshold: 80 },
    }))
    expect(client.getQueryData(keys.periods(1))).toEqual([updated])
    expect(client.getQueryState(keys.detail(1))?.isInvalidated).toBe(true)
    expect(client.getQueryState(keys.list())?.isInvalidated).toBe(true)
  })
})
