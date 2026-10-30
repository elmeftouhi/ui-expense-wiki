import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { queryKeys } from '@/api/query-keys'
import { chartService } from '../services/chartService'
import { SpendingTrendChart } from '../components/SpendingTrendChart'

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ data }: { data: unknown[] }) => <div data-testid="chart-data">{JSON.stringify(data)}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}))

const daily = {
  year: 2026, month: 10,
  totals: [{ day: 1, total: 4.8 }, { day: 2, total: 0 }, { day: 3, total: 246.99 }],
  previousMonthTotals: [{ day: 1, total: 12 }, { day: 3, total: 50 }, { day: 30, total: 7 }],
}
const monthly = {
  year: 2026,
  totals: [{ month: 1, total: 0 }, { month: 10, total: 1169.68 }],
  previousYearTotals: [{ month: 10, total: 125 }, { month: 1, total: 0 }],
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

function renderChart(tenantId = 1) {
  return render(
    <QueryClientProvider client={client}>
      <SpendingTrendChart tenantId={tenantId} currency="USD" locale="en-US" />
    </QueryClientProvider>,
  )
}

describe('expense chart service', () => {
  it('requests both live endpoints with tenant, periods, and cancellation', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValueOnce(daily).mockResolvedValueOnce(monthly)
    const signal = new AbortController().signal
    expect(await chartService.daily(7, 2026, 10, signal)).toEqual(daily)
    expect(await chartService.monthly(7, 2026, signal)).toEqual(monthly)
    expect(get).toHaveBeenNthCalledWith(1, '/v1/expenses/charts/daily', {
      tenantId: 7, params: { year: 2026, month: 10 }, signal,
    })
    expect(get).toHaveBeenNthCalledWith(2, '/v1/expenses/charts/monthly', {
      tenantId: 7, params: { year: 2026 }, signal,
    })
  })

  it('parses decimal strings and rejects invalid totals instead of using demo data', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
      ...daily, totals: [{ day: 1, total: '4.80' }, { day: 2, total: '0' }],
    })
    expect((await chartService.daily(1, 2026, 10)).totals).toEqual([
      { day: 1, total: 4.8 }, { day: 2, total: 0 },
    ])
    get.mockResolvedValue({ ...daily, totals: [{ day: 1, total: 'invalid' }] })
    await expect(chartService.daily(1, 2026, 10)).rejects.toThrow('invalid chart data')
    get.mockResolvedValue({ ...daily, previousMonthTotals: [{ day: 1, total: 'invalid' }] })
    await expect(chartService.daily(1, 2026, 10)).rejects.toThrow('invalid chart data')
    get.mockResolvedValue({ year: 2026, month: 10, totals: [] })
    expect((await chartService.daily(1, 2026, 10)).previousMonthTotals).toEqual([])
    get.mockResolvedValue({ ...monthly, previousYearTotals: undefined })
    await expect(chartService.monthly(1, 2026)).rejects.toThrow('invalid chart data')
  })
})

describe('live spending chart', () => {
  it('loads the current period, keeps zero days, calculates summaries, and navigates months and years', async () => {
    const user = userEvent.setup()
    const now = new Date()
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(daily)
    renderChart()
    expect(screen.getByRole('status')).toHaveTextContent('Loading spending chart')
    const chart = await screen.findByTestId('chart-data')
    const points = JSON.parse(chart.textContent!)
    expect(points).toHaveLength(31)
    expect(points.slice(0, 3)).toMatchObject([
      { day: 1, total: 4.8, previousTotal: 12 },
      { day: 2, total: 0, previousTotal: 0 },
      { day: 3, total: 246.99, previousTotal: 50 },
    ])
    expect(points[29]).toMatchObject({ day: 30, total: 0, previousTotal: 7 })
    expect(points[30]).toMatchObject({ day: 31, total: 0, previousTotal: 0 })
    expect(screen.getByText('$251.79')).toBeInTheDocument()
    expect(screen.getByText('$83.93')).toBeInTheDocument()
    expect(get).toHaveBeenLastCalledWith('/v1/expenses/charts/daily', expect.objectContaining({
      tenantId: 1, params: { year: now.getFullYear(), month: now.getMonth() + 1 },
    }))
    expect(get).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/v1/expenses/charts/daily', expect.objectContaining({
      params: { year: prev.getFullYear(), month: prev.getMonth() + 1 },
    })))

    get.mockResolvedValue(monthly)
    await user.click(screen.getByRole('button', { name: 'Monthly Totals' }))
    await screen.findByText('$1,169.68')
    expect(JSON.parse(screen.getByTestId('chart-data').textContent!)).toEqual([
      { month: 'January', shortMonth: 'Jan', amount: 0, previousYearAmount: 0 },
      { month: 'October', shortMonth: 'Oct', amount: 1169.68, previousYearAmount: 125 },
    ])
    expect(get).toHaveBeenLastCalledWith('/v1/expenses/charts/monthly', expect.objectContaining({
      params: { year: now.getFullYear() },
    }))
    await user.click(screen.getByRole('button', { name: 'Previous year' }))
    await waitFor(() => expect(get).toHaveBeenLastCalledWith('/v1/expenses/charts/monthly', expect.objectContaining({
      params: { year: now.getFullYear() - 1 },
    })))
  })

  it('shows an error without fake totals and retries the selected request', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'get').mockRejectedValueOnce(new Error('Chart unavailable')).mockResolvedValue(daily)
    renderChart()
    expect(await screen.findByRole('alert')).toHaveTextContent('Chart unavailable')
    expect(screen.queryByTestId('chart-data')).not.toBeInTheDocument()
    expect(screen.queryByText('Daily Avg:')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry chart' }))
    await screen.findByTestId('chart-data')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders empty responses explicitly but retains all-zero periods as real chart data', async () => {
    const user = userEvent.setup()
    vi.spyOn(apiClient, 'get')
      .mockResolvedValueOnce({ ...daily, totals: [], previousMonthTotals: [] })
      .mockResolvedValue({ ...monthly, totals: [{ month: 1, total: 0 }], previousYearTotals: [{ month: 1, total: 0 }] })
    renderChart()
    await screen.findByText('No spending data for this period.')
    await user.click(screen.getByRole('button', { name: 'Monthly Totals' }))
    expect(await screen.findByTestId('chart-data')).toHaveTextContent('"amount":0')
    expect(screen.queryByText('No spending data for this period.')).not.toBeInTheDocument()
  })

  it('sizes the daily axis to the current month length and keeps previous-only data visible', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      year: 2026, month: 2, totals: [],
      previousMonthTotals: [{ day: 28, total: 9 }, { day: 31, total: 99 }],
    })
    renderChart()
    const points = JSON.parse((await screen.findByTestId('chart-data')).textContent!)
    expect(points).toHaveLength(28)
    expect(points[27]).toMatchObject({ day: 28, total: 0, previousTotal: 9 })
    expect(points.every((p: { total: number }) => p.total === 0)).toBe(true)
  })

  it('isolates tenants and refreshes chart data after expense invalidation', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(daily)
    const { rerender } = renderChart()
    await screen.findByText('$251.79')
    get.mockResolvedValue({ ...daily, totals: [{ day: 1, total: 10 }] })
    rerender(
      <QueryClientProvider client={client}>
        <SpendingTrendChart tenantId={2} currency="USD" locale="en-US" />
      </QueryClientProvider>,
    )
    await screen.findAllByText('$10.00')
    expect(get).toHaveBeenLastCalledWith('/v1/expenses/charts/daily', expect.objectContaining({ tenantId: 2 }))
    get.mockResolvedValue({ ...daily, totals: [{ day: 1, total: 20 }] })
    await client.invalidateQueries({ queryKey: queryKeys.tenantScope(2).expenses.all })
    await screen.findAllByText('$20.00')
  })
})
