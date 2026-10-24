import { act, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TenantProvider } from '../context/TenantContext'
import { useActiveTenant } from '../context/useActiveTenant'
import { configurationService } from '@/features/settings/services/configurationService'
import { useUpdateConfiguration } from '@/features/settings/hooks/useConfiguration'
import { configuration } from '@/features/settings/__tests__/configurationFixtures'
import { toConfigurationRequest, toFormValues } from '@/features/settings/schemas/configurationSchema'
import { formatCurrency } from '@/lib/formatters'
import { TenantSwitcher } from '../components/TenantSwitcher'

const auth = vi.hoisted(() => ({
  user: { id: 1 }, selectedTenantId: 1, isAuthenticated: true, switchTenant: vi.fn(),
}))
vi.mock('@/features/auth', () => ({ useAuth: () => auth }))
vi.mock('../services/tenantService', () => ({
  tenantService: {
    getMyTenants: vi.fn(async () => [
      { id: 1, name: 'First workspace', role: 'ADMIN', isDefault: true },
      { id: 2, name: 'Second workspace', role: 'ADMIN', isDefault: false },
    ]),
  },
}))

function CurrencyDisplay() {
  const { activeTenant, availableTenants } = useActiveTenant()
  const update = useUpdateConfiguration(activeTenant.id)
  return (
    <>
      <p>Currency: {activeTenant.currency}</p>
      <p>Locale: {activeTenant.locale}</p>
      <p>List currency: {availableTenants.find((tenant) => tenant.id === activeTenant.id)?.currency}</p>
      <p>{formatCurrency(25, { currency: activeTenant.currency, locale: activeTenant.locale })}</p>
      <button onClick={() => update.mutate({
        ...toConfigurationRequest(toFormValues(configuration)), currency: 'EUR',
      })}>Save EUR</button>
    </>
  )
}

let client: QueryClient
beforeEach(() => {
  auth.selectedTenantId = 1
  auth.isAuthenticated = true
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  vi.spyOn(configurationService, 'get').mockResolvedValue({ ...configuration, currency: 'GBP' })
  vi.spyOn(configurationService, 'update').mockResolvedValue({ ...configuration, currency: 'EUR' })
})
afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
})

function tree() {
  return <QueryClientProvider client={client}><MemoryRouter><TenantProvider><CurrencyDisplay /><TenantSwitcher /></TenantProvider></MemoryRouter></QueryClientProvider>
}

describe('tenant currency integration', () => {
  it('loads persisted currency before displaying formatted workspace amounts', async () => {
    let resolve!: (value: typeof configuration) => void
    vi.mocked(configurationService.get).mockReturnValue(new Promise((done) => { resolve = done }))
    render(tree())
    await waitFor(() => expect(configurationService.get).toHaveBeenCalledWith(1, expect.any(AbortSignal)))
    expect(screen.queryByText('Currency: USD')).not.toBeInTheDocument()
    expect(screen.getByRole('status')).toBeInTheDocument()
    await act(async () => resolve({ ...configuration, currency: 'GBP' }))
    expect(await screen.findByText('Currency: GBP')).toBeInTheDocument()
    expect(screen.getByText('£25.00')).toBeInTheDocument()
  })

  it('updates shared currency and formatted amounts immediately after saving', async () => {
    render(tree())
    await screen.findByText('Currency: GBP')
    await userEvent.click(screen.getByRole('button', { name: 'Save EUR' }))
    expect(await screen.findByText('Currency: EUR')).toBeInTheDocument()
    expect(screen.getByText('€25.00')).toBeInTheDocument()
    expect(screen.getByText('List currency: EUR')).toBeInTheDocument()
  })

  it('uses saved currency and language in the top navigation and selected dropdown row', async () => {
    vi.mocked(configurationService.get).mockResolvedValue({ ...configuration, currency: 'EUR', language: 'FR' })
    vi.mocked(configurationService.update).mockResolvedValue({ ...configuration, currency: 'GBP', language: 'DE' })
    render(tree())
    expect(await screen.findByText('Locale: fr')).toBeInTheDocument()
    const trigger = screen.getByRole('button', { name: /First workspace/ })
    expect(trigger).toHaveTextContent('EUR')
    expect(trigger).toHaveTextContent('fr')
    await userEvent.click(trigger)
    const selected = screen.getByRole('option', { name: /First workspace/ })
    expect(selected).toHaveTextContent('EUR')
    expect(selected).toHaveTextContent('fr')
    expect(within(screen.getByRole('listbox')).queryByText(/USD|en-US/)).not.toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Second workspace/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Save EUR' }))
    await waitFor(() => expect(trigger).toHaveTextContent('GBP'))
    expect(trigger).toHaveTextContent('de')
    await userEvent.click(trigger)
    const updatedSelected = screen.getByRole('option', { name: /First workspace/ })
    expect(updatedSelected).toHaveTextContent('GBP')
    expect(updatedSelected).toHaveTextContent('de')
  })

  it('loads the selected tenant currency without retaining the previous tenant currency', async () => {
    vi.mocked(configurationService.get).mockImplementation(async (id) => ({
      ...configuration, tenantId: Number(id), currency: Number(id) === 1 ? 'GBP' : 'JPY',
    }))
    const view = render(tree())
    await screen.findByText('Currency: GBP')
    auth.selectedTenantId = 2
    view.rerender(tree())
    expect(screen.queryByText('Currency: GBP')).not.toBeInTheDocument()
    expect(await screen.findByText('Currency: JPY')).toBeInTheDocument()
  })

  it('retains the current currency if saving fails', async () => {
    vi.mocked(configurationService.update).mockRejectedValue(new Error('Save failed'))
    render(tree())
    await screen.findByText('Currency: GBP')
    await userEvent.click(screen.getByRole('button', { name: 'Save EUR' }))
    await waitFor(() => expect(client.isMutating()).toBe(0))
    expect(screen.getByText('Currency: GBP')).toBeInTheDocument()
  })

  it('shows a retry instead of silently displaying USD when configuration fails', async () => {
    vi.mocked(configurationService.get).mockRejectedValueOnce(new Error('Server unavailable'))
    render(tree())
    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable')
    expect(screen.queryByText('Currency: USD')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reload workspace settings' }))
    expect(await screen.findByText('Currency: GBP')).toBeInTheDocument()
  })

  it('preserves demo behavior without requesting authenticated configuration', async () => {
    auth.isAuthenticated = false
    render(tree())
    expect(await screen.findByText(/Currency:/)).toBeInTheDocument()
    expect(configurationService.get).not.toHaveBeenCalled()
  })
})
