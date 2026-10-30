import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiClientError } from '@/api/client'
import { useActiveTenant } from '@/features/tenants'
import { BudgetHistorySection } from '../components/BudgetHistorySection'
import { budgetService } from '../services/budgetService'
import type { BudgetPeriodResponse } from '../types'
import { period, tenantContext } from './fixtures'

vi.mock('@/features/tenants', () => ({ useActiveTenant: vi.fn() }))

const clients: QueryClient[] = []

const history: BudgetPeriodResponse[] = [
  { ...period, id: 12, startDate: '2026-10-01', endDate: '2026-10-31', spentAmount: 1100, status: 'OPEN' },
  {
    ...period, id: 11, startDate: '2026-09-01', endDate: '2026-09-30', spentAmount: 0, status: 'CLOSED',
    warningType: 'AMOUNT', warningThreshold: 750,
  },
]

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  clients.push(client)
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return render(<BudgetHistorySection budgetId={1} currency="USD" locale="en-US" />, { wrapper: Wrapper })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  vi.mocked(useActiveTenant).mockReturnValue(tenantContext)
})

afterEach(() => {
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

describe('BudgetHistorySection', () => {
  it('shows a skeleton while loading, then renders API rows with derived remaining and thresholds', async () => {
    const pending = deferred<BudgetPeriodResponse[]>()
    vi.spyOn(budgetService, 'getHistory').mockReturnValue(pending.promise)
    renderSection()
    expect(screen.getByTestId('history-loading')).toBeInTheDocument()
    expect(budgetService.getHistory).toHaveBeenCalledWith(1, 12)

    pending.resolve(history)
    const table = await screen.findByRole('table', { name: 'Budget history' })
    const rows = within(table).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(2)

    const [oct, sep] = rows.map((row) => within(row).getAllByRole('cell').map((c) => c.textContent))
    expect(oct[0]).toContain('Oct 2026')
    expect(oct.slice(1)).toEqual(['$1,000.00', '$1,100.00', '-$100.00', 'OPEN', '80%'])
    expect(sep[0]).toContain('Sep 2026')
    expect(sep.slice(1)).toEqual(['$1,000.00', '$0.00', '$1,000.00', 'CLOSED', '$750.00'])
    expect(screen.queryByTestId('history-loading')).not.toBeInTheDocument()
  })

  it('renders the empty state when the API returns no periods', async () => {
    vi.spyOn(budgetService, 'getHistory').mockResolvedValue([])
    renderSection()
    expect(await screen.findByText('No history for this range')).toBeInTheDocument()
    expect(screen.getByText(/last 12 months/)).toBeInTheDocument()
  })

  it('shows an error with a retry button that refetches', async () => {
    const user = userEvent.setup()
    vi.spyOn(budgetService, 'getHistory')
      .mockRejectedValueOnce(new ApiClientError('Server exploded', 500, { message: 'Server exploded' }))
      .mockResolvedValueOnce(history)
    renderSection()
    expect(await screen.findByText('Server exploded')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('table', { name: 'Budget history' })).toBeInTheDocument()
    expect(budgetService.getHistory).toHaveBeenCalledTimes(2)
  })

  it('handles a 400 for an unsupported range and lets the user reset to the default', async () => {
    const user = userEvent.setup()
    vi.spyOn(budgetService, 'getHistory').mockImplementation(async (_id, monthsBack) => {
      if (monthsBack === 24) throw new ApiClientError('Bad request', 400, { message: 'monthsBack must be <= 60' })
      return history
    })
    renderSection()
    await screen.findByRole('table', { name: 'Budget history' })
    await user.selectOptions(screen.getByLabelText('Months back'), '24')
    expect(await screen.findByText("That history range isn't supported")).toBeInTheDocument()
    expect(budgetService.getHistory).toHaveBeenCalledTimes(2)
    await user.click(screen.getByRole('button', { name: 'Reset to 12 months' }))
    expect(await screen.findByRole('table', { name: 'Budget history' })).toBeInTheDocument()
    expect(screen.getByLabelText('Months back')).toHaveValue('12')
  })

  it('refetches with the selected preset value', async () => {
    const user = userEvent.setup()
    vi.spyOn(budgetService, 'getHistory').mockResolvedValue(history)
    renderSection()
    await screen.findByRole('table', { name: 'Budget history' })
    await user.selectOptions(screen.getByLabelText('Months back'), '3')
    await waitFor(() => expect(budgetService.getHistory).toHaveBeenLastCalledWith(1, 3))
    await user.selectOptions(screen.getByLabelText('Months back'), '6')
    await waitFor(() => expect(budgetService.getHistory).toHaveBeenLastCalledWith(1, 6))
    expect(vi.mocked(budgetService.getHistory).mock.calls.map(([, n]) => n)).toEqual([12, 3, 6])
  })

  it('validates custom values client-side and only fetches valid ones', async () => {
    const user = userEvent.setup()
    vi.spyOn(budgetService, 'getHistory').mockResolvedValue(history)
    renderSection()
    await screen.findByRole('table', { name: 'Budget history' })
    await user.selectOptions(screen.getByLabelText('Months back'), 'custom')
    const input = screen.getByLabelText('Custom months back')

    await user.clear(input)
    await user.type(input, '61')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    expect(screen.getByRole('alert')).toHaveTextContent('between 1 and 60')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(budgetService.getHistory).toHaveBeenCalledTimes(1)

    await user.clear(input)
    await user.type(input, '36')
    await user.click(screen.getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(budgetService.getHistory).toHaveBeenLastCalledWith(1, 36))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
