import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { ExpensesPage } from '../pages/ExpensesPage'
import type { ExpensePageResponse } from '../types'

vi.mock('@/features/tenants', () => ({
  useActiveTenant: () => ({
    activeTenant: { id: 1, name: 'Test workspace', currency: 'USD', locale: 'en-US' },
    canEdit: false,
  }),
  useResetOnTenantChange: () => undefined,
}))

vi.mock('@/features/budgets/hooks/useCategoryOptions', () => ({
  useCategoryOptions: () => ({
    options: [{ id: 3, name: 'Utilities', depth: 0, active: true }],
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

const result: ExpensePageResponse = { content: [], page: 0, size: 25, totalPages: 4, totalElements: 100 }
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

function renderPage() {
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><ExpensesPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('expense filter requests', () => {
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
      params: { year: now.getFullYear() - 1, month: 2, type: 'NORMAL', categoryId: 3, page: 0, size: 50, sort: 'amount,asc' },
    }))
    const requests = vi.mocked(apiClient.get).mock.calls.length
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by payment method' }), '2')
    await waitFor(() => expect(vi.mocked(apiClient.get).mock.calls.length).toBeGreaterThan(requests))
  })

  it('fetches again when revisiting cached filters and shows a loader until the response arrives', async () => {
    const user = userEvent.setup()
    renderPage()
    await screen.findByText('100 expenses')
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
})
