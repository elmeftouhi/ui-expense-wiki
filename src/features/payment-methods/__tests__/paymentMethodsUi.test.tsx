import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { queryKeys } from '@/api/query-keys'
import { PaymentMethodsSettings } from '../PaymentMethodsSettings'
import { PaymentMethodSelect } from '../PaymentMethodSelect'
import { paymentMethodService, type PaymentMethod } from '../paymentMethodService'
import { ExpenseFormPage } from '@/features/expenses/pages/ExpenseFormPage'
import { SubscriptionFormModal } from '@/features/subscriptions/components/SubscriptionFormModal'
import { subscription } from '@/features/subscriptions/__tests__/fixtures'
import { expense } from '@/features/expenses/__tests__/expenseFixtures'
import { expenseService } from '@/features/expenses/services/expenseService'
import { subscriptionService } from '@/features/subscriptions/services/subscriptionService'

const context = vi.hoisted(() => ({ tenantId: 101, success: vi.fn() }))
vi.mock('@/features/tenants', () => ({
  useActiveTenant: () => ({ activeTenant: { id: context.tenantId, name: 'Workspace', currency: 'USD', locale: 'en-US' }, canEdit: true, isAdmin: true }),
}))
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ success: context.success }) }))
vi.mock('@/features/budgets/hooks/useCategoryOptions', () => ({
  useCategoryOptions: () => ({ options: [], byId: new Map(), isLoading: false, error: null, refetch: vi.fn() }),
}))

const cash: PaymentMethod = { id: 1, name: 'Cash', type: 'CASH', active: true, isDefault: true }
const card: PaymentMethod = { id: 2, name: 'Card', type: 'CREDIT_CARD', active: true, isDefault: false }
let methods: PaymentMethod[]
const clients: QueryClient[] = []

function mount(children: ReactNode, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  clients.push(client)
  function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>{children}</MemoryRouter></QueryClientProvider>
  }
  return { ...render(children, { wrapper: Wrapper }), client }
}

beforeEach(() => {
  context.tenantId = 101
  methods = [{ ...cash }, { ...card }]
  vi.spyOn(paymentMethodService, 'list').mockImplementation(async (_tenant, showInactive) => methods.filter((method) => showInactive || method.active))
  vi.spyOn(paymentMethodService, 'create').mockImplementation(async (_tenant, payload) => {
    const method = { id: 3, ...payload }
    methods = [...methods, method]
    return method
  })
  vi.spyOn(paymentMethodService, 'update').mockImplementation(async (_tenant, id, payload) => {
    methods = methods.map((method) => method.id === id ? { id, ...payload } : method)
    return { id, ...payload }
  })
  vi.spyOn(paymentMethodService, 'setDefault').mockImplementation(async (_tenant, id) => {
    methods = methods.map((method) => ({ ...method, isDefault: method.id === id }))
    return methods.find((method) => method.id === id)!
  })
})
afterEach(() => {
  cleanup()
  clients.splice(0).forEach((client) => client.clear())
  vi.restoreAllMocks()
})

describe('payment method settings', () => {
  it('lists methods, adds and edits, switches default, and confirms soft removal', async () => {
    const user = userEvent.setup()
    mount(<PaymentMethodsSettings isAdmin />)
    await screen.findByRole('button', { name: 'Edit Cash' })
    expect(screen.getByRole('button', { name: 'Remove Cash' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Add payment method' }))
    await user.type(screen.getByLabelText('Name'), 'Bank')
    await user.selectOptions(screen.getByLabelText('Type'), 'BANK_TRANSFER')
    await user.click(screen.getByRole('button', { name: 'Save payment method' }))
    await waitFor(() => expect(paymentMethodService.create).toHaveBeenCalledWith(101, { name: 'Bank', type: 'BANK_TRANSFER', active: true, isDefault: false }))
    await screen.findByRole('button', { name: 'Edit Bank' })
    await user.click(screen.getByRole('button', { name: 'Edit Bank' }))
    await user.clear(screen.getByLabelText('Name'))
    await user.type(screen.getByLabelText('Name'), 'Checking')
    await user.click(screen.getByRole('button', { name: 'Save payment method' }))
    await screen.findByRole('button', { name: 'Edit Checking' })
    const row = screen.getByRole('button', { name: 'Edit Card' }).closest('li')!
    await user.click(within(row).getByRole('button', { name: 'Set default' }))
    await waitFor(() => expect(paymentMethodService.setDefault).toHaveBeenCalledWith(101, 2))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove Cash' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Remove Cash' }))
    expect(paymentMethodService.update).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Confirm removal' }))
    await waitFor(() => expect(paymentMethodService.update).toHaveBeenLastCalledWith(101, 1, expect.objectContaining({ active: false, isDefault: false })))
    expect(await screen.findByText('Inactive')).toBeInTheDocument()
  })

  it('has read-only access for non-admins', async () => {
    mount(<PaymentMethodsSettings isAdmin={false} />)
    await screen.findByText('Card')
    expect(screen.queryByRole('button', { name: /Add payment method|Edit Card|Set default|Remove/ })).not.toBeInTheDocument()
  })

  it('validates names and keeps the form open on server errors', async () => {
    const user = userEvent.setup()
    vi.mocked(paymentMethodService.create).mockRejectedValue(new Error('Name already exists'))
    mount(<PaymentMethodsSettings isAdmin />)
    await screen.findByRole('button', { name: 'Edit Card' })
    await user.click(screen.getByRole('button', { name: 'Add payment method' }))
    await user.click(screen.getByRole('button', { name: 'Save payment method' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter a payment method name.')
    await user.type(screen.getByLabelText('Name'), 'Cash')
    await user.click(screen.getByRole('button', { name: 'Save payment method' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Name already exists')
    expect(screen.getByLabelText('Name')).toHaveValue('Cash')
  })
})

describe('payment method form selection', () => {
  it('loads and preselects the default for new expenses without overwriting a user choice on refetch', async () => {
    const user = userEvent.setup()
    let resolve!: (value: PaymentMethod[]) => void
    vi.mocked(paymentMethodService.list).mockReturnValueOnce(new Promise((done) => { resolve = done }))
    const { client } = mount(<ExpenseFormPage />)
    expect(screen.getByRole('combobox', { name: 'Payment method' })).toBeDisabled()
    await act(async () => resolve([cash, card]))
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Payment method' })).toHaveValue('1'))
    await user.selectOptions(screen.getByRole('combobox', { name: 'Payment method' }), '2')
    await act(async () => { await client.invalidateQueries({ queryKey: queryKeys.tenantScope(101).paymentMethods.all }) })
    expect(screen.getByRole('combobox', { name: 'Payment method' })).toHaveValue('2')
  })

  it('preserves an existing expense method rather than replacing it with the default', async () => {
    vi.spyOn(expenseService, 'getById').mockResolvedValue({ ...expense, paymentMethodId: 2 })
    mount(<Routes><Route path="/expenses/:expenseId/edit" element={<ExpenseFormPage />} /></Routes>, '/expenses/7/edit')
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Payment method' })).toHaveValue('2'))
  })

  it('preselects the default for new subscriptions and preserves their method on edit', async () => {
    const view = mount(<SubscriptionFormModal onClose={vi.fn()} onSubmit={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Payment method' })).toHaveValue('1'))
    view.unmount()
    mount(<SubscriptionFormModal subscription={subscription} onClose={vi.fn()} onSubmit={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('combobox', { name: 'Payment method' })).toHaveValue('2'))
  })

  it('blocks saving with unavailable methods, supports historical filters, and reloads on tenant change', async () => {
    methods = [{ ...cash, active: false }, card]
    vi.spyOn(subscriptionService, 'update')
    const view = mount(<SubscriptionFormModal subscription={{ ...subscription, paymentMethodId: 1 }} onClose={vi.fn()} onSubmit={vi.fn()} />)
    expect(await screen.findByText('Choose an active payment method before saving.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    view.unmount()
    const onChange = vi.fn()
    const filter = mount(<PaymentMethodSelect id="method-filter" filter onChange={onChange} />)
    await screen.findByRole('option', { name: 'Cash (inactive)' })
    await userEvent.selectOptions(screen.getByRole('combobox'), '1')
    expect(onChange).toHaveBeenCalledWith(1)
    await userEvent.selectOptions(screen.getByRole('combobox'), '')
    expect(onChange).toHaveBeenLastCalledWith(undefined)
    context.tenantId = 102
    filter.rerender(<PaymentMethodSelect id="method-filter" filter onChange={onChange} />)
    await waitFor(() => expect(paymentMethodService.list).toHaveBeenCalledWith(102, true))
  })

  it('shows actionable list failures and an empty-state link to settings', async () => {
    vi.mocked(paymentMethodService.list).mockRejectedValueOnce(new Error('Could not load methods'))
    mount(<PaymentMethodSelect id="method-select" onChange={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load methods')
    methods = []
    await userEvent.click(screen.getByRole('button', { name: 'Retry payment methods' }))
    expect(await screen.findByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings')
  })
})
