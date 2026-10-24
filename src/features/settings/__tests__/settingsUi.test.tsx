import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { queryKeys } from '@/api/query-keys'
import { SettingsPage } from '../pages/SettingsPage'
import { configurationService } from '../services/configurationService'
import { configuration } from './configurationFixtures'
import type { TenantConfiguration } from '../types'
import { paymentMethodService } from '@/features/payment-methods/paymentMethodService'

const mocks = vi.hoisted(() => ({
  tenantId: 1 as number | string,
  isAdmin: true,
  success: vi.fn(),
}))
vi.mock('@/features/tenants', () => ({
  useActiveTenant: () => ({
    activeTenant: { id: mocks.tenantId, name: `Workspace ${mocks.tenantId}` },
    isAdmin: mocks.isAdmin, currentRole: mocks.isAdmin ? 'ADMIN' : 'VIEWER',
  }),
}))
vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ success: mocks.success }),
}))

let client: QueryClient

beforeEach(() => {
  mocks.tenantId = 1
  mocks.isAdmin = true
  mocks.success.mockReset()
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  vi.spyOn(configurationService, 'get').mockResolvedValue(configuration)
  vi.spyOn(configurationService, 'update').mockResolvedValue(configuration)
  vi.spyOn(paymentMethodService, 'list').mockResolvedValue([])
})
afterEach(() => {
  client.clear()
  vi.restoreAllMocks()
})

function mount() {
  return render(<QueryClientProvider client={client}><SettingsPage /></QueryClientProvider>)
}
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}
async function edit(label: string, value: string) {
  const user = userEvent.setup()
  const input = screen.getByLabelText(label)
  await user.clear(input)
  if (value) await user.type(input, value)
}

describe('workspace settings', () => {
  it('shows loading then all server preferences and read-only audit details', async () => {
    const pending = deferred<TenantConfiguration>()
    vi.mocked(configurationService.get).mockReturnValue(pending.promise)
    mount()
    expect(screen.getByText('Loading workspace settings...')).toBeInTheDocument()
    await act(async () => pending.resolve(configuration))
    expect(await screen.findByLabelText('Currency')).toHaveValue('USD')
    expect(screen.getByLabelText('Notification channels')).toHaveValue('IN_APP')
    expect(screen.getByLabelText('Payment reminder days')).toHaveValue('3, 7')
    expect(screen.getByLabelText('Language')).toHaveValue('EN')
    expect(screen.getByLabelText('Week starts on')).toHaveValue('MONDAY')
    expect(screen.getByLabelText('Time format')).toHaveValue('FORMAT_24H')
    expect(screen.getByLabelText('Date format')).toHaveValue('yyyy-MM-dd')
    expect(screen.getByLabelText('Decimal places')).toHaveValue(2)
    expect(screen.getByLabelText('Expense rounding method')).toHaveValue('NONE')
    expect(screen.getByLabelText('Reporting period')).toHaveValue('CALENDAR_MONTH')
    expect(screen.getByText('Configuration ID')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('saves encoded lists and uses the server response as the new baseline', async () => {
    const pending = deferred<TenantConfiguration>()
    vi.mocked(configurationService.update).mockReturnValue(pending.promise)
    mount()
    await screen.findByLabelText('Currency')
    await edit('Payment reminder days', '1, 5')
    await edit('Budget alert threshold (%)', '90')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(configurationService.update).toHaveBeenCalledWith(1, expect.objectContaining({
      autoPaymentReminderDays: '[1,5]', notificationChannels: '["IN_APP"]', budgetAlertThreshold: 90,
    })))
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled()
    expect(screen.getByLabelText('Currency')).toBeDisabled()
    expect(mocks.success).not.toHaveBeenCalled()
    await act(async () => pending.resolve({ ...configuration, autoPaymentReminderDays: '[1,5]', budgetAlertThreshold: 90 }))
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Settings saved', expect.any(String)))
    expect(screen.getByLabelText('Payment reminder days')).toHaveValue('1, 5')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
    expect(client.getQueryData(queryKeys.tenantScope(1).configuration.general())).toMatchObject({ budgetAlertThreshold: 90 })
  })

  it('displays validation failures without updating', async () => {
    mount()
    await screen.findByLabelText('Currency')
    await edit('Payment reminder days', '3, -7')
    await edit('Budget alert threshold (%)', '101')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/Enter whole, non-negative days/)).toBeInTheDocument()
    expect(screen.getByLabelText('Budget alert threshold (%)')).toHaveAttribute('aria-invalid', 'true')
    expect(configurationService.update).not.toHaveBeenCalled()
  })

  it('keeps the draft and shows save errors, allowing a retry', async () => {
    vi.mocked(configurationService.update).mockRejectedValueOnce(new Error('Settings could not be saved'))
    mount()
    await screen.findByLabelText('Currency')
    await edit('Timezone', 'Europe/Paris')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Settings could not be saved')
    expect(screen.getByLabelText('Timezone')).toHaveValue('Europe/Paris')
    expect(mocks.success).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.success).toHaveBeenCalledOnce())
  })

  it('provides a retry after a load failure', async () => {
    vi.mocked(configurationService.get).mockRejectedValueOnce(new Error('Cannot load settings'))
    mount()
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot load settings')
    expect(screen.queryByLabelText('Currency')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Reload settings' }))
    expect(await screen.findByLabelText('Currency')).toHaveValue('USD')
  })

  it('lets non-administrators view but not edit or save', async () => {
    mocks.isAdmin = false
    mount()
    expect(await screen.findByLabelText('Currency')).toBeDisabled()
    expect(screen.getByLabelText('Payment reminder days')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument()
    expect(screen.getByText(/read-only access/)).toBeInTheDocument()
  })

  it('discards edits and preserves drafts during background refresh', async () => {
    mount()
    await screen.findByLabelText('Currency')
    await edit('Timezone', 'Europe/Paris')
    act(() => client.setQueryData(queryKeys.tenantScope(1).configuration.general(), { ...configuration, timezone: 'Asia/Tokyo' }))
    expect(screen.getByLabelText('Timezone')).toHaveValue('Europe/Paris')
    await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(screen.getByLabelText('Timezone')).toHaveValue('Asia/Tokyo')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('refreshes pristine fields when newer configuration arrives', async () => {
    mount()
    await screen.findByLabelText('Currency')
    act(() => client.setQueryData(queryKeys.tenantScope(1).configuration.general(), { ...configuration, timezone: 'Asia/Tokyo' }))
    await waitFor(() => expect(screen.getByLabelText('Timezone')).toHaveValue('Asia/Tokyo'))
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('cancels stale refreshes before saving configuration', async () => {
    mount()
    await screen.findByLabelText('Currency')
    const refresh = deferred<TenantConfiguration>()
    vi.mocked(configurationService.get).mockReturnValueOnce(refresh.promise)
    void client.invalidateQueries({ queryKey: queryKeys.tenantScope(1).configuration.general() })
    await edit('Timezone', 'Europe/Paris')
    vi.mocked(configurationService.update).mockResolvedValue({ ...configuration, timezone: 'Europe/Paris' })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(mocks.success).toHaveBeenCalledOnce())
    await act(async () => refresh.resolve(configuration))
    expect(screen.getByLabelText('Timezone')).toHaveValue('Europe/Paris')
    expect(client.getQueryData(queryKeys.tenantScope(1).configuration.general())).toMatchObject({ timezone: 'Europe/Paris' })
  })

  it('clears drafts on tenant switch and isolates an in-flight save result', async () => {
    const pending = deferred<TenantConfiguration>()
    vi.mocked(configurationService.update).mockReturnValue(pending.promise)
    vi.mocked(configurationService.get).mockImplementation(async (id) => ({
      ...configuration, tenantId: Number(id), timezone: Number(id) === 1 ? 'UTC' : 'Asia/Tokyo',
    }))
    const view = mount()
    await screen.findByLabelText('Currency')
    await edit('Timezone', 'Europe/Paris')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    mocks.tenantId = 2
    view.rerender(<QueryClientProvider client={client}><SettingsPage /></QueryClientProvider>)
    await waitFor(() => expect(screen.getByLabelText('Timezone')).toHaveValue('Asia/Tokyo'))
    await act(async () => pending.resolve({ ...configuration, timezone: 'Europe/Paris' }))
    expect(screen.getByLabelText('Timezone')).toHaveValue('Asia/Tokyo')
    expect(client.getQueryData(queryKeys.tenantScope(2).configuration.general())).toMatchObject({ timezone: 'Asia/Tokyo' })
    expect(mocks.success).not.toHaveBeenCalled()
  })

  it('updates the correct cache when a tenant ID is represented as a string', async () => {
    mocks.tenantId = '1'
    mount()
    await screen.findByLabelText('Currency')
    await edit('Timezone', 'Europe/Paris')
    vi.mocked(configurationService.update).mockResolvedValue({ ...configuration, timezone: 'Europe/Paris' })
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(client.getQueryData(queryKeys.tenantScope('1').configuration.general())).toMatchObject({ timezone: 'Europe/Paris' }))
  })
})
