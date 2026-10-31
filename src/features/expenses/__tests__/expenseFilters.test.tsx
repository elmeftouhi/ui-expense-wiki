import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { ToastProvider } from '@/components/ui/toaster'
import { ExpensesPage } from '../pages/ExpensesPage'
import type { ExpensePageResponse } from '../types'
import { expense } from './expenseFixtures'

vi.mock('@/features/tenants', () => ({
  useActiveTenant: () => ({
    activeTenant: { id: 1, name: 'Test workspace', currency: 'USD', locale: 'en-US' },
    canEdit: false,
  }),
  useResetOnTenantChange: () => undefined,
}))

vi.mock('@/features/budgets/hooks/useCategoryOptions', () => ({
  useCategoryOptions: () => ({
    options: [
      { id: 3, name: 'Utilities', depth: 0, active: true },
      { id: 5, name: 'Electricity', depth: 1, parentName: 'Utilities', active: true },
      { id: 8, name: 'Home meter', depth: 2, parentName: 'Electricity', active: true },
      { id: 9, name: 'Water', depth: 1, parentName: 'Utilities', active: true },
      { id: 12, name: 'Travel', depth: 0, active: true },
    ],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('@/features/payment-methods/usePaymentMethods', () => ({
  usePaymentMethods: () => ({
    data: [{ id: 2, name: 'Card', type: 'CREDIT_CARD', active: true, isDefault: false }],
    isPending: false,
    error: null,
  }),
}))

const result: ExpensePageResponse = { content: [], page: 0, size: 25, totalPages: 4, totalElements: 100, filteredTotalAmount: 1345.5, recordsCount: 0 }
let client: QueryClient

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  vi.spyOn(apiClient, 'get').mockResolvedValue(result)
})

afterEach(() => {
  cleanup()
  client.clear()
  vi.restoreAllMocks()
})

function renderPage(initialEntry = '/expenses') {
  return render(
    <QueryClientProvider client={client}>
      <ToastProvider><MemoryRouter initialEntries={[initialEntry]}><ExpensesPage /></MemoryRouter></ToastProvider>
    </QueryClientProvider>,
  )
}

describe('expense filter requests', () => {
  it('filters Paid and Pending, resets pagination, preserves other filters, and clears status', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.get).mockImplementation(async (_url, options) => {
      const content = [
        { ...expense, description: 'Pending expense' },
        { ...expense, id: 8, description: 'Paid expense', status: 'PAID' },
      ].filter((item) => !options?.params?.status || item.status === options.params.status)
      return {
        ...result, totalPages: 1,
        content, totalElements: content.length,
      }
    })
    renderPage()
    await screen.findByText('2 expenses')
    await user.click(screen.getByRole('button', { name: /More filters/ }))
    expect(screen.getByRole('combobox', { name: 'Payment status' })).toHaveValue('')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'NORMAL')
    await screen.findByText('2 expenses')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Payment status' }), 'PAID')
    await screen.findByText('1 expense')
    expect(screen.getByRole('link', { name: 'Paid expense' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Pending expense' })).not.toBeInTheDocument()
    expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: expect.objectContaining({ type: 'NORMAL', status: 'PAID', page: 0, size: 25 }),
    })

    await user.selectOptions(screen.getByRole('combobox', { name: 'Payment status' }), 'PENDING')
    await screen.findByRole('link', { name: 'Pending expense' })
    expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: expect.objectContaining({ type: 'NORMAL', status: 'PENDING', page: 0, size: 25 }),
    })
    expect(screen.queryByRole('link', { name: 'Paid expense' })).not.toBeInTheDocument()
    await user.selectOptions(screen.getByRole('combobox', { name: 'Payment status' }), '')
    await screen.findByText('2 expenses')
    expect(screen.getByRole('link', { name: 'Paid expense' })).toBeInTheDocument()
    expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: { year: new Date().getFullYear(), month: new Date().getMonth() + 1, type: 'NORMAL', page: 0, size: 25, sort: 'dueDate,desc' },
    })
  })

  it('returns to the first page when changing payment status', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('100 expenses')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2 of 4')
    vi.mocked(apiClient.get).mockResolvedValue({ ...result, totalPages: 1, totalElements: 1, content: [expense] })
    await user.click(screen.getByRole('button', { name: /More filters/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Payment status' }), 'PENDING')
    await screen.findByText('1 expense')
    expect(screen.getByText('Page 1 of 1')).toBeInTheDocument()
  })

  it('requests current dates and 25 rows, and sends changed filters, sorting, and pagination to the backend', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('100 expenses')
    const now = new Date()
    expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: { year: now.getFullYear(), month: now.getMonth() + 1, page: 0, size: 25, sort: 'dueDate,desc' },
    })

    await user.click(screen.getByRole('button', { name: 'Next' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: expect.objectContaining({ page: 1, size: 25 }),
    }))
    await screen.findByText('Page 2 of 4')
    await user.click(screen.getByRole('button', { name: /More filters/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50')
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: expect.objectContaining({ page: 0, size: 50 }),
    }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Year' }), String(now.getFullYear() - 1))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: { year: now.getFullYear() - 1, page: 0, size: 50, sort: 'dueDate,desc' },
    }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Month' }), '2')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'NORMAL')
    await user.click(screen.getByRole('button', { name: 'Category' }))
    await user.click(screen.getByRole('treeitem', { name: 'Utilities' }))
    await screen.findByText('100 expenses')
    await user.click(screen.getByRole('button', { name: 'Amount' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: { year: now.getFullYear() - 1, month: 2, type: 'NORMAL', categoryIds: '3,5,8,9', page: 0, size: 50, sort: 'amount,asc' },
    }))
    const requests = vi.mocked(apiClient.get).mock.calls.length
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by payment method' }), '2')
    await waitFor(() => expect(vi.mocked(apiClient.get).mock.calls.length).toBeGreaterThan(requests))
  })

  it('fetches again when revisiting cached filters and shows a loader until the response arrives', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('100 expenses')
    await user.click(screen.getByRole('button', { name: /More filters/ }))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'NORMAL')
    await screen.findByText('100 expenses')
    const requests = vi.mocked(apiClient.get).mock.calls.length
    let resolve!: (value: ExpensePageResponse) => void
    vi.mocked(apiClient.get).mockReturnValueOnce(new Promise<ExpensePageResponse>((done) => { resolve = done }))

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), '')
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(requests + 1))
    expect(screen.getByRole('status')).toHaveTextContent('Loading expenses')
    expect(screen.queryByText('100 expenses')).not.toBeInTheDocument()
    await act(async () => resolve({ ...result, totalElements: 75 }))
    expect(await screen.findByText('75 expenses')).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('keeps search and category visible while optional filters can be opened and collapsed without clearing them', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('100 expenses')
    expect(screen.getByRole('searchbox', { name: 'Search expenses' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Category' })).toBeVisible()
    expect(screen.queryByRole('combobox', { name: 'Year' })).not.toBeInTheDocument()
    const moreBtn = screen.getByRole('button', { name: /More filters/ })
    expect(moreBtn).toHaveAttribute('aria-expanded', 'false')
    // No phantom active filter badge on initial default period
    expect(moreBtn).not.toHaveTextContent(/active filters/)

    await user.click(moreBtn)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Payment status' }), 'PAID')
    await screen.findByText('100 expenses')
    const requests = vi.mocked(apiClient.get).mock.calls.length
    await user.click(screen.getByRole('button', { name: /Fewer filters/ }))
    expect(screen.queryByRole('combobox', { name: 'Payment status' })).not.toBeInTheDocument()
    expect(apiClient.get).toHaveBeenCalledTimes(requests)
    await user.click(screen.getByRole('button', { name: /More filters/ }))
    expect(screen.getByRole('combobox', { name: 'Payment status' })).toHaveValue('PAID')
  })

  it('adds entire category branches without duplicates and removes only the chosen chip', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('100 expenses')
    await user.click(screen.getByRole('button', { name: 'Category' }))
    await user.click(screen.getByRole('treeitem', { name: 'Utilities' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: expect.objectContaining({ categoryIds: '3,5,8,9', page: 0 }),
    }))
    expect(screen.queryByRole('button', { name: 'Remove Utilities' })).not.toBeInTheDocument()
    for (const name of ['Electricity', 'Home meter', 'Water']) {
      expect(screen.getByRole('button', { name: `Remove ${name}` })).toBeVisible()
    }

    await user.click(screen.getByRole('button', { name: 'Category' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search categories' }), 'Electricity')
    await user.click(screen.getByRole('treeitem', { name: 'Electricity' }))
    expect(screen.getAllByRole('button', { name: /^Remove / })).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Remove Electricity' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2 of 4')
    await user.click(screen.getByRole('button', { name: 'Remove Water' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: expect.objectContaining({ categoryIds: '3,5,8', page: 0 }),
    }))
    expect(screen.getByRole('button', { name: 'Remove Home meter' })).toBeVisible()

    await user.click(screen.getByRole('button', { name: 'Category' }))
    await user.click(screen.getByRole('treeitem', { name: 'Travel' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: expect.objectContaining({ categoryIds: '3,5,8,12', page: 0 }),
    }))
    await user.click(screen.getByRole('button', { name: 'Clear categories' }))
    await waitFor(() => expect(vi.mocked(apiClient.get).mock.lastCall?.[1]?.params).not.toHaveProperty('categoryIds'))
    expect(screen.queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument()
  })

  it('omits categoryIds when the last category chip is removed', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('100 expenses')
    await user.click(screen.getByRole('button', { name: 'Category' }))
    await user.click(screen.getByRole('treeitem', { name: 'Travel' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: expect.objectContaining({ categoryIds: '12' }),
    }))
    await user.click(screen.getByRole('button', { name: 'Remove Travel' }))
    await waitFor(() => expect(vi.mocked(apiClient.get).mock.lastCall?.[1]?.params).not.toHaveProperty('categoryIds'))
    expect(screen.queryByRole('button', { name: 'Clear categories' })).not.toBeInTheDocument()
  })

  it('displays the backend total across pages and updates it with the applied search', async () => {
    const user = userEvent.setup()
    renderPage()
    expect(await screen.findByText('$1,345.50')).toBeVisible()
    expect(screen.queryByText(/Workspace currency:/)).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2 of 4')
    expect(screen.getByText('$1,345.50')).toBeVisible()
    vi.mocked(apiClient.get).mockResolvedValue({ ...result, content: [expense], filteredTotalAmount: 250.75, recordsCount: 1 })
    await user.type(screen.getByRole('searchbox', { name: 'Search expenses' }), 'bill')
    expect(await screen.findByText('$250.75')).toBeVisible()
    vi.mocked(apiClient.get).mockResolvedValue({ ...result, totalElements: 0, totalPages: 0, filteredTotalAmount: 0 })
    await user.type(screen.getByRole('searchbox', { name: 'Search expenses' }), ' unmatched')
    expect(await screen.findByText('$0.00')).toBeVisible()
  })

  it('debounces search, resets pagination, preserves categories, and clears the search parameter', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('100 expenses')
    await user.click(screen.getByRole('button', { name: 'Category' }))
    await user.click(screen.getByRole('treeitem', { name: 'Travel' }))
    await screen.findByText('100 expenses')
    await user.click(screen.getByRole('button', { name: 'Next' }))
    await screen.findByText('Page 2 of 4')
    const requests = vi.mocked(apiClient.get).mock.calls.length
    await user.type(screen.getByRole('searchbox', { name: 'Search expenses' }), '  train  ')
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: expect.objectContaining({ search: 'train', categoryIds: '12', page: 0 }),
    }))
    expect(apiClient.get).toHaveBeenCalledTimes(requests + 1)
    await user.clear(screen.getByRole('searchbox', { name: 'Search expenses' }))
    await waitFor(() => expect(vi.mocked(apiClient.get).mock.lastCall?.[1]?.params).not.toHaveProperty('search'))
    expect(vi.mocked(apiClient.get).mock.lastCall?.[1]?.params).toHaveProperty('categoryIds', '12')
  })

  it('hydrates from URL query params, navigates months inline, and filters via quick status pills and row categories', async () => {
    const user = userEvent.setup()
    vi.mocked(apiClient.get).mockResolvedValue({
      ...result,
      content: [{ ...expense, id: 21, categoryId: 12, categoryName: 'Travel' }],
      totalElements: 1,
      totalPages: 1,
    })

    renderPage('/expenses?status=PENDING&search=flight')
    await screen.findByText('1 expense')
    expect(screen.getByRole('searchbox', { name: 'Search expenses' })).toHaveValue('flight')
    expect(apiClient.get).toHaveBeenCalledWith('/v1/expenses', {
      params: expect.objectContaining({ status: 'PENDING', search: 'flight', page: 0 }),
    })

    // Quick status pills update status in 1 tap
    const quickStatus = screen.getByRole('group', { name: 'Quick status filter' })
    await user.click(within(quickStatus).getByRole('button', { name: 'Paid' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: expect.objectContaining({ status: 'PAID', search: 'flight', page: 0 }),
    }))

    // Clicking the category name inside a table row filters to that category instead of leaving the page
    const table = await screen.findByRole('table')
    await user.click(within(table).getByRole('button', { name: 'Travel' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: expect.objectContaining({ categoryIds: '12', page: 0 }),
    }))

    // Inline month switcher steps backward and toggles All dates
    await user.click(screen.getByRole('button', { name: 'Previous month' }))
    const now = new Date()
    const expectedPrevMonth = now.getMonth() === 0 ? 12 : now.getMonth()
    const expectedPrevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear()
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: expect.objectContaining({ year: expectedPrevYear, month: expectedPrevMonth, page: 0 }),
    }))

    await user.click(screen.getByRole('button', { name: 'All dates' }))
    await waitFor(() => {
      const lastParams = vi.mocked(apiClient.get).mock.lastCall?.[1]?.params
      expect(lastParams).not.toHaveProperty('year')
      expect(lastParams).not.toHaveProperty('month')
    })

    // Clear all filters restores defaults
    await user.click(screen.getByRole('button', { name: 'Clear all filters' }))
    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith('/v1/expenses', {
      params: { year: now.getFullYear(), month: now.getMonth() + 1, page: 0, size: 25, sort: 'dueDate,desc' },
    }))
  })
})
