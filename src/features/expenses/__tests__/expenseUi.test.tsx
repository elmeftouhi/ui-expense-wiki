import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ExpenseActions } from '../components/ExpenseActions'
import { ExpenseTable } from '../components/ExpenseTable'
import { ExpenseFormPage } from '../pages/ExpenseFormPage'
import { ExpensesPage } from '../pages/ExpensesPage'
import { useExpenses } from '../hooks/useExpenses'
import { ExpenseStatisticsPage } from '../pages/ExpenseStatisticsPage'
import { expense } from './expenseFixtures'

const mocks = vi.hoisted(() => ({
  changeStatus: vi.fn(),
  markPaid: vi.fn(),
  deleteExpense: vi.fn(),
  createExpense: vi.fn(),
  updateExpense: vi.fn(),
  stats: { isLoading: false, error: null as unknown, data: null as unknown, refetch: vi.fn() },
  detail: { isLoading: false, error: null as unknown, data: null as unknown, refetch: vi.fn() },
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/features/tenants', () => ({
  useActiveTenant: () => ({
    activeTenant: { id: 'tenant-1', name: 'Northwind', currency: 'USD', locale: 'en-US' },
    canEdit: true,
  }),
  useResetOnTenantChange: () => undefined,
}))

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}))

vi.mock('@/features/payment-methods/usePaymentMethods', () => {
  const data = [
    { id: 1, name: 'Cash', type: 'CASH', active: true, isDefault: true },
    { id: 2, name: 'Card', type: 'CREDIT_CARD', active: true, isDefault: false },
  ]
  return { usePaymentMethods: () => ({ data, isPending: false, error: null, refetch: vi.fn() }) }
})

vi.mock('@/features/budgets/hooks/useCategoryOptions', () => ({
  useCategoryOptions: () => ({
    options: [
      { id: 3, name: 'Utilities', depth: 0, active: true },
      { id: 4, name: 'Groceries', depth: 0, active: true },
      { id: 5, name: 'Electricity', parentName: 'Utilities', depth: 1, active: true },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))

vi.mock('../hooks/useExpenses', () => ({
  useChangeExpenseStatus: () => ({ mutateAsync: mocks.changeStatus, isPending: false }),
  useMarkExpenseAsPaid: () => ({ mutateAsync: mocks.markPaid, isPending: false }),
  useDeleteExpense: () => ({ mutateAsync: mocks.deleteExpense, isPending: false }),
  useCreateExpense: () => ({ mutateAsync: mocks.createExpense, isPending: false }),
  useUpdateExpense: () => ({ mutateAsync: mocks.updateExpense, isPending: false }),
  useExpense: () => mocks.detail,
  useExpenseStatistics: () => mocks.stats,
  useExpenses: vi.fn(() => ({ data: { content: [], totalPages: 0, totalElements: 0 }, isLoading: false, error: null })),
}))

afterEach(cleanup)

beforeEach(() => {
  vi.clearAllMocks()
  mocks.changeStatus.mockResolvedValue(expense)
  mocks.markPaid.mockResolvedValue({ ...expense, status: 'PAID', paidDate: '2025-02-11' })
  mocks.deleteExpense.mockResolvedValue(undefined)
  mocks.createExpense.mockResolvedValue(expense)
  mocks.updateExpense.mockResolvedValue(expense)
  mocks.detail = { isLoading: false, error: null, data: null, refetch: vi.fn() }
  mocks.stats = {
    isLoading: false,
    error: null,
    data: {
      totalExpenses: 82.5,
      totalPaid: 0,
      totalPending: 82.5,
      totalOverdue: 0,
      overdueCount: 0,
      pendingCount: 1,
      byCategory: [{ categoryId: 3, categoryName: 'Utilities', total: 82.5, budget: 100, percentage: 82.5 }],
    },
    refetch: vi.fn(),
  }
})

describe('expense UI', () => {
  it('filters expenses by payment method and clears the filter with Reset', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ExpensesPage /></MemoryRouter>)
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by payment method' }), '2')
    expect(useExpenses).toHaveBeenLastCalledWith(expect.objectContaining({ paymentMethodId: 2, page: 0 }))
    await user.click(screen.getByRole('button', { name: 'Reset' }))
    expect(useExpenses).toHaveBeenLastCalledWith(expect.not.objectContaining({ paymentMethodId: 2 }))
    expect(screen.getByRole('combobox', { name: 'Filter by payment method' })).toHaveValue('')
  })

  it('renders expense rows, status, and generated bill context', () => {
    render(
      <MemoryRouter>
        <ExpenseTable expenses={[{ ...expense, type: 'SUBSCRIPTION', hasSubscription: true }]} canEdit={false} page={0} totalPages={1} onPageChange={vi.fn()} />,
      </MemoryRouter>,
    )
    expect(screen.getByText('Electricity bill')).toBeInTheDocument()
    expect(screen.getByText('Utilities')).toBeInTheDocument()
    expect(screen.getByText('Subscription')).toBeInTheDocument()
    expect(screen.getByText('pending')).toBeInTheDocument()
  })

  it.each(['Record expense', 'Save and add new'])('validates required fields when clicking %s', async (action) => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/expenses/new']}>
        <Routes><Route path="/expenses/new" element={<ExpenseFormPage />} /></Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: action }))
    expect(await screen.findByText('Choose a category.')).toBeInTheDocument()
    expect(screen.queryByText('Description is required.')).not.toBeInTheDocument()
    expect(screen.getByText('Amount must be greater than 0.')).toBeInTheDocument()
    expect(mocks.createExpense).not.toHaveBeenCalled()
  })

  it('waits for save and add new, resets all fields, and can record another expense', async () => {
    let resolveSave!: (value: typeof expense) => void
    mocks.createExpense.mockReturnValueOnce(new Promise<typeof expense>((resolve) => { resolveSave = resolve }))
    const user = userEvent.setup()
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    render(
      <MemoryRouter initialEntries={['/expenses/new']}>
        <Routes>
          <Route path="/expenses/new" element={<ExpenseFormPage />} />
          <Route path="/expenses/:expenseId" element={<p>Saved expense</p>} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Category' }))
    await user.click(screen.getByRole('treeitem', { name: 'Groceries' }))
    await user.type(screen.getByRole('spinbutton', { name: /Amount/ }), '25')
    await user.type(screen.getByLabelText(/Description/), 'Weekly groceries')
    await user.selectOptions(screen.getByLabelText('Type'), 'SUBSCRIPTION')
    await user.clear(screen.getByLabelText('Due date'))
    await user.type(screen.getByLabelText('Due date'), '2026-10-01')
    await user.clear(screen.getByLabelText(/Paid date/))
    await user.selectOptions(screen.getByLabelText(/Payment method/), '2')
    await user.type(screen.getByLabelText(/Notes/), 'First entry')
    await user.click(screen.getByRole('button', { name: 'Save and add new' }))

    await waitFor(() => expect(mocks.createExpense).toHaveBeenCalledExactlyOnceWith({
      categoryId: 4, amount: 25, description: 'Weekly groceries', type: 'SUBSCRIPTION',
      dueDate: '2026-10-01', paidDate: null, paymentMethodId: 2, notes: 'First entry',
    }))
    expect(screen.getByRole('button', { name: 'Save and add new' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Record expense' })).toBeDisabled()
    expect(screen.getByRole('spinbutton', { name: /Amount/ })).toHaveValue(25)
    expect(mocks.success).not.toHaveBeenCalled()

    await act(async () => { resolveSave(expense) })
    expect(screen.getByRole('heading', { name: 'Record an expense' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Category' })).toHaveTextContent('Choose a category')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Category' })).toHaveFocus())
    expect(screen.getByRole('spinbutton', { name: /Amount/ })).toHaveValue(0)
    expect(screen.getByLabelText(/Description/)).toHaveValue('')
    expect(screen.getByLabelText('Type')).toHaveValue('NORMAL')
    expect(screen.queryByLabelText('Due date')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Paid date/)).toHaveValue(today)
    expect(screen.getByLabelText(/Payment method/)).toHaveValue('1')
    expect(screen.getByLabelText(/Notes/)).toHaveValue('')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mocks.success).toHaveBeenCalledWith('Expense recorded.')

    await user.click(screen.getByRole('button', { name: 'Category' }))
    await user.click(screen.getByRole('treeitem', { name: 'Utilities' }))
    await user.type(screen.getByRole('spinbutton', { name: /Amount/ }), '10')
    await user.click(screen.getByRole('button', { name: 'Record expense' }))
    expect(await screen.findByText('Saved expense')).toBeInTheDocument()
    expect(mocks.createExpense).toHaveBeenLastCalledWith({
      categoryId: 3, amount: 10, description: 'Utilities', type: 'NORMAL',
      dueDate: today, paidDate: today, paymentMethodId: 1, notes: null,
    })
  })

  it('preserves the draft when save and add new fails and allows retrying', async () => {
    mocks.createExpense.mockRejectedValueOnce(new Error('Could not save this expense.'))
    const user = userEvent.setup()
    render(<MemoryRouter><ExpenseFormPage /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Category' }))
    await user.click(screen.getByRole('treeitem', { name: 'Groceries' }))
    await user.type(screen.getByRole('spinbutton', { name: /Amount/ }), '25')
    await user.type(screen.getByLabelText(/Description/), 'Keep this draft')
    await user.click(screen.getByRole('button', { name: 'Save and add new' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save this expense.')
    expect(screen.getByRole('button', { name: 'Category' })).toHaveTextContent('Groceries')
    expect(screen.getByRole('spinbutton', { name: /Amount/ })).toHaveValue(25)
    expect(screen.getByLabelText(/Description/)).toHaveValue('Keep this draft')
    expect(mocks.success).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Save and add new' }))
    await waitFor(() => expect(screen.getByRole('spinbutton', { name: /Amount/ })).toHaveValue(0))
    expect(mocks.createExpense).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('searches categories, focuses amount after selection, and defaults a blank description', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/expenses/new']}>
        <Routes>
          <Route path="/expenses/new" element={<ExpenseFormPage />} />
          <Route path="/expenses/:expenseId" element={<p>Saved expense</p>} />
        </Routes>
      </MemoryRouter>,
    )
    await user.click(screen.getByRole('button', { name: 'Category' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search categories' }), 'groc')
    expect(screen.queryByRole('treeitem', { name: 'Utilities' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('treeitem', { name: 'Groceries' }))
    expect(screen.getByRole('spinbutton', { name: /Amount/ })).toHaveFocus()
    expect(screen.getByPlaceholderText('Groceries')).toBeInTheDocument()
    await user.type(screen.getByRole('spinbutton', { name: /Amount/ }), '25')
    await user.click(screen.getByRole('button', { name: 'Record expense' }))
    await waitFor(() => expect(mocks.createExpense).toHaveBeenCalledWith(expect.objectContaining({
      categoryId: 4, amount: 25, description: 'Groceries',
    })))
    expect(await screen.findByText('Saved expense')).toBeInTheDocument()
  })

  it('supports keyboard category selection and keeps a custom description on edit', async () => {
    mocks.detail.data = expense
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/expenses/7/edit']}>
        <Routes>
          <Route path="/expenses/:expenseId/edit" element={<ExpenseFormPage />} />
          <Route path="/expenses/:expenseId" element={<p>Saved expense</p>} />
        </Routes>
      </MemoryRouter>,
    )
    expect(screen.queryByRole('button', { name: 'Save and add new' })).not.toBeInTheDocument()
    screen.getByRole('button', { name: 'Category' }).focus()
    await user.keyboard('{ArrowDown}')
    await user.type(screen.getByRole('searchbox', { name: 'Search categories' }), 'groc')
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('treeitem', { name: 'Groceries' })).toHaveFocus()
    await user.keyboard('{Enter}')
    expect(screen.getByRole('spinbutton', { name: /Amount/ })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.updateExpense).toHaveBeenCalledWith({
      id: 7, payload: expect.objectContaining({ categoryId: 4, description: 'Electricity bill' }),
    }))
  })

  it('hides the due date for a normal expense, defaults paid date to today, and uses it as due date', async () => {
    const user = userEvent.setup()
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    render(<MemoryRouter><ExpenseFormPage /></MemoryRouter>)
    expect(screen.queryByLabelText('Due date')).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Paid date/)).toHaveValue(today)

    await user.selectOptions(screen.getByLabelText('Type'), 'SUBSCRIPTION')
    expect(screen.getByLabelText('Due date')).toBeInTheDocument()
    await user.selectOptions(screen.getByLabelText('Type'), 'NORMAL')
    expect(screen.queryByLabelText('Due date')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Category' }))
    await user.click(screen.getByRole('treeitem', { name: 'Groceries' }))
    await user.type(screen.getByRole('spinbutton', { name: /Amount/ }), '12')
    await user.clear(screen.getByLabelText(/Paid date/))
    await user.type(screen.getByLabelText(/Paid date/), '2026-10-01')
    await user.click(screen.getByRole('button', { name: 'Record expense' }))
    await waitFor(() => expect(mocks.createExpense).toHaveBeenCalledWith(expect.objectContaining({
      type: 'NORMAL', paidDate: '2026-10-01', dueDate: '2026-10-01',
    })))
  })

  it('shows a helpful message when category search has no matches', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ExpenseFormPage /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Category' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search categories' }), 'nonexistent')
    expect(screen.getByRole('status')).toHaveTextContent('No matching categories.')
  })

  it('sends the paid date through the mark-as-paid dialog', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ExpenseActions expense={expense} canEdit /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Mark as paid' }))
    await user.clear(screen.getByLabelText('Paid date'))
    await user.type(screen.getByLabelText('Paid date'), '2025-02-11')
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark as paid' }))
    await waitFor(() => expect(mocks.markPaid).toHaveBeenCalledWith({ id: 7, paidDate: '2025-02-11' }))
  })

  it('requires and submits paidDate when changing status to PAID', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ExpenseActions expense={expense} canEdit /></MemoryRouter>)
    await user.click(screen.getByRole('button', { name: 'Change status' }))
    await user.selectOptions(screen.getByLabelText('Status'), 'PAID')
    await user.type(screen.getByLabelText('Paid date'), '2025-02-12')
    await user.click(screen.getByRole('button', { name: 'Save status' }))
    await waitFor(() => expect(mocks.changeStatus).toHaveBeenCalledWith({
      id: 7,
      payload: { status: 'PAID', paidDate: '2025-02-12' },
    }))
  })

  it('shows compact row actions: quick mark-as-paid and an overflow menu', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><ExpenseActions expense={expense} canEdit variant="compact" /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()

    const trigger = screen.getByRole('button', { name: 'More actions for Electricity bill' })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await user.click(trigger)
    const menu = screen.getByRole('menu', { name: 'More actions for Electricity bill' })
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual(['View details', 'Edit', 'Change status', 'Delete'])
    expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toHaveAttribute('href', '/expenses/7/edit')
    expect(within(menu).getByRole('menuitem', { name: 'View details' })).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(within(menu).getByRole('menuitem', { name: 'Edit' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    await user.click(trigger)
    await user.click(screen.getByRole('menuitem', { name: 'Change status' }))
    expect(screen.getByRole('dialog', { name: 'Change expense status' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    await user.click(screen.getByRole('button', { name: 'Mark Electricity bill as paid' }))
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Mark as paid' }))
    await waitFor(() => expect(mocks.markPaid).toHaveBeenCalledWith(expect.objectContaining({ id: 7 })))
  })

  it('closes the row menu on outside click and hides the quick action for paid expenses', async () => {
    const user = userEvent.setup()
    render(<MemoryRouter><p>Outside</p><ExpenseActions expense={{ ...expense, status: 'PAID', paidDate: '2025-02-11' }} canEdit variant="compact" /></MemoryRouter>)
    expect(screen.queryByRole('button', { name: /as paid/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'More actions for Electricity bill' }))
    expect(screen.getByRole('menu')).toBeInTheDocument()
    await user.click(screen.getByText('Outside'))
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders read-only compact rows without action controls', () => {
    render(<MemoryRouter><ExpenseActions expense={expense} canEdit={false} variant="compact" /></MemoryRouter>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders a stacked card list with a sort control on small screens', async () => {
    const user = userEvent.setup()
    const onSort = vi.fn()
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    try {
      render(
        <MemoryRouter>
          <ExpenseTable expenses={[{ ...expense, type: 'SUBSCRIPTION', hasSubscription: true }]} canEdit page={0} totalPages={1} onPageChange={vi.fn()} sort="dueDate" direction="asc" onSort={onSort} />
        </MemoryRouter>,
      )
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      const list = screen.getByRole('list', { name: 'Expense list' })
      const card = within(list).getByRole('listitem')
      expect(within(card).getByRole('link', { name: 'Electricity bill' })).toHaveAttribute('href', '/expenses/7')
      expect(within(card).getByText('Subscription')).toBeInTheDocument()
      expect(within(card).getByText('pending')).toBeInTheDocument()
      expect(within(card).getByRole('button', { name: 'More actions for Electricity bill' })).toBeInTheDocument()

      await user.selectOptions(screen.getByLabelText('Sort by'), 'amount')
      expect(onSort).toHaveBeenCalledWith('amount')
      await user.click(screen.getByRole('button', { name: 'Sort descending' }))
      expect(onSort).toHaveBeenLastCalledWith('dueDate')
    } finally {
      vi.unstubAllGlobals()
    }
  })

  it('uses compact row actions in the desktop table', () => {
    render(
      <MemoryRouter>
        <ExpenseTable expenses={[expense]} canEdit page={0} totalPages={1} onPageChange={vi.fn()} />
      </MemoryRouter>,
    )
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Expense', 'Amount', 'Status', 'Due date', 'Actions'])
    expect(within(table).getByRole('button', { name: 'More actions for Electricity bill' })).toBeInTheDocument()
    expect(within(table).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('shows statistics totals and category breakdown', () => {
    render(<MemoryRouter><ExpenseStatisticsPage /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: 'Expense statistics' })).toBeInTheDocument()
    expect(screen.getByText('By category')).toBeInTheDocument()
    expect(screen.getByText('Utilities')).toBeInTheDocument()
    expect(screen.getByText('82.5%')).toBeInTheDocument()
  })
})
