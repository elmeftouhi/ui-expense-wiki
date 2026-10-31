import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiClientError } from '@/api/client'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { configurationService } from '@/features/settings/services/configurationService'
import { configuration } from '@/features/settings/__tests__/configurationFixtures'
import { paymentMethodService } from '@/features/payment-methods/paymentMethodService'
import * as dataTransferServiceModule from '../services/dataTransferService'
import type { ImportUserDataResponse, UserDataBackupSnapshot } from '../types'

const mocks = vi.hoisted(() => ({
  tenantId: 1 as number | string,
  tenantName: 'Acme Corp',
  isAdmin: true,
  isSwitching: false,
  switchTenant: vi.fn<(id: number | string) => Promise<void>>(async () => {}),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
}))

vi.mock('@/features/tenants', () => ({
  useActiveTenant: () => ({
    activeTenant: { id: mocks.tenantId, name: mocks.tenantName },
    isAdmin: mocks.isAdmin,
    currentRole: mocks.isAdmin ? 'ADMIN' : 'VIEWER',
    isSwitching: mocks.isSwitching,
    switchTenant: mocks.switchTenant,
  }),
}))

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    success: mocks.toastSuccess,
    error: mocks.toastError,
    info: mocks.toastInfo,
    toast: vi.fn(),
    dismiss: vi.fn(),
  }),
}))

const validSnapshot: UserDataBackupSnapshot = {
  metadata: {
    formatVersion: '1.0',
    exportedAt: '2026-10-31T21:30:00Z',
    tenantName: 'Acme Corp',
  },
  categories: [{ id: 1, name: 'Software' }],
  expenses: [{ id: 100, amount: 49.99 }, { id: 101, amount: 125.0 }],
}

const importCounts = {
  exercices: 1,
  categories: 5,
  paymentMethods: 2,
  budgets: 3,
  budgetPeriodInstances: 4,
  subscriptions: 2,
  expenses: 19,
  subscriptionPayments: 6,
  notifications: 3,
  activityLogs: 14,
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let queryClient: QueryClient

beforeEach(() => {
  sessionStorage.clear()
  mocks.tenantId = 1
  mocks.tenantName = 'Acme Corp'
  mocks.isAdmin = true
  mocks.isSwitching = false
  mocks.switchTenant.mockReset()
  mocks.toastSuccess.mockReset()
  mocks.toastError.mockReset()
  mocks.toastInfo.mockReset()

  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  vi.spyOn(configurationService, 'get').mockResolvedValue(configuration)
  vi.spyOn(paymentMethodService, 'list').mockResolvedValue([])
})

afterEach(() => {
  queryClient.clear()
  sessionStorage.clear()
  vi.restoreAllMocks()
})

function renderDataTransferSettings() {
  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsPage initialSection="data-transfer" />
    </QueryClientProvider>,
  )
}

describe('Settings -> Data Transfer UI', () => {
  it('navigates to Data Transfer from the Settings rail and displays safety guidance', async () => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={queryClient}>
        <SettingsPage />
      </QueryClientProvider>,
    )

    const navButton = await screen.findByRole('button', { name: 'Data Transfer' })
    await user.click(navButton)

    expect(navButton).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'Data Transfer' })).toBeInTheDocument()
    expect(
      screen.getByText(
        'Import creates a new workspace and does not overwrite existing workspace data.',
      ),
    ).toBeInTheDocument()
  })

  it('exports workspace data as a timestamped .json file with loading and success toast', async () => {
    const user = userEvent.setup()
    const pendingExport = deferred<UserDataBackupSnapshot>()
    const exportSpy = vi
      .spyOn(dataTransferServiceModule, 'exportDataTransfer')
      .mockReturnValue(pendingExport.promise)

    const createObjectUrlSpy = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:http://localhost/backup-123')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})

    let capturedDownload = ''
    let capturedHref = ''
    const anchorClickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        capturedDownload = this.download
        capturedHref = this.href
      })

    renderDataTransferSettings()

    const exportButton = await screen.findByRole('button', {
      name: 'Export current workspace data',
    })
    await user.click(exportButton)

    expect(exportSpy).toHaveBeenCalledWith({ tenantId: 1 })
    expect(screen.getByRole('button', { name: /Exporting\.\.\./i })).toBeDisabled()

    await act(async () => {
      pendingExport.resolve(validSnapshot)
    })

    await waitFor(() => {
      expect(anchorClickSpy).toHaveBeenCalledOnce()
    })
    expect(createObjectUrlSpy).toHaveBeenCalledOnce()
    expect(capturedHref).toBe('blob:http://localhost/backup-123')
    expect(capturedDownload).toMatch(/^expense-backup-acme-corp-\d{8}-\d{6}\.json$/)
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      'Workspace backup exported',
      expect.stringContaining(capturedDownload),
    )
  })

  it('shows an error toast and alert when export fails', async () => {
    const user = userEvent.setup()
    vi.spyOn(dataTransferServiceModule, 'exportDataTransfer').mockRejectedValue(
      new ApiClientError('Forbidden', 403, { message: 'Admin privileges required.' }),
    )

    renderDataTransferSettings()

    await user.click(
      await screen.findByRole('button', { name: 'Export current workspace data' }),
    )

    expect(await screen.findByRole('alert')).toHaveTextContent('Admin privileges required.')
    expect(mocks.toastError).toHaveBeenCalledWith('Export failed', 'Admin privileges required.')
  })

  it('completes import via file upload after confirmation, displays counts table, and offers workspace switch CTA when not auto-switched', async () => {
    const user = userEvent.setup()
    const pendingImport = deferred<ImportUserDataResponse>()
    const importSpy = vi
      .spyOn(dataTransferServiceModule, 'importDataTransfer')
      .mockReturnValue(pendingImport.promise)

    renderDataTransferSettings()

    await user.type(
      await screen.findByLabelText(/New workspace name/i),
      'Restored Q4 Ledger',
    )
    // Uncheck auto-switch default workspace
    const switchCheckbox = screen.getByLabelText(/Set as default workspace/i)
    expect(switchCheckbox).toBeChecked()
    await user.click(switchCheckbox)
    expect(switchCheckbox).not.toBeChecked()

    const backupFile = new File([JSON.stringify(validSnapshot)], 'acme-backup.json', {
      type: 'application/json',
    })
    await user.upload(screen.getByLabelText('Backup JSON file'), backupFile)

    expect(await screen.findByText('acme-backup.json')).toBeInTheDocument()
    expect(screen.getByText(/Valid backup JSON verified/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Import workspace backup' }))

    // Confirmation modal opens before network request
    const dialog = screen.getByRole('dialog', { name: 'Confirm workspace import' })
    expect(within(dialog).getByText('Restored Q4 Ledger')).toBeInTheDocument()
    expect(within(dialog).getByText(/No — keep current default/i)).toBeInTheDocument()
    expect(importSpy).not.toHaveBeenCalled()

    await user.click(within(dialog).getByRole('button', { name: 'Confirm import' }))

    expect(importSpy).toHaveBeenCalledWith(
      {
        tenantName: 'Restored Q4 Ledger',
        switchDefaultTenant: false,
        backup: validSnapshot,
      },
      { tenantId: 1 },
    )
    expect(within(dialog).getByRole('button', { name: /Importing\.\.\./i })).toBeDisabled()

    await act(async () => {
      pendingImport.resolve({
        tenantId: 456,
        tenantName: 'Restored Q4 Ledger',
        switchedDefaultTenant: false,
        counts: importCounts,
      })
    })

    // Modal closes and success receipt renders
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    const summary = screen.getByRole('region', { name: 'Import summary' })
    expect(within(summary).getByText('Restored Q4 Ledger')).toBeInTheDocument()
    expect(within(summary).getByText('ID #456')).toBeInTheDocument()

    const countsTable = within(summary).getByRole('table', {
      name: 'Imported record counts',
    })
    expect(within(countsTable).getByText('Expenses')).toBeInTheDocument()
    expect(within(countsTable).getByText('19')).toBeInTheDocument()
    expect(within(countsTable).getByText('Activity logs')).toBeInTheDocument()
    expect(within(countsTable).getByText('14')).toBeInTheDocument()
    expect(within(countsTable).getByText('59')).toBeInTheDocument() // total imported records

    // CTA is shown because switchedDefaultTenant is false
    expect(mocks.switchTenant).not.toHaveBeenCalled()
    const switchCta = within(summary).getByRole('button', {
      name: 'Switch to imported workspace',
    })
    await user.click(switchCta)
    expect(mocks.switchTenant).toHaveBeenCalledWith(456)
  })

  it('auto-switches when switchedDefaultTenant is true and hides the manual switch CTA', async () => {
    const user = userEvent.setup()
    vi.spyOn(dataTransferServiceModule, 'importDataTransfer').mockResolvedValue({
      tenantId: 123,
      tenantName: 'My restored workspace',
      switchedDefaultTenant: true,
      counts: importCounts,
    })

    renderDataTransferSettings()

    await user.type(
      await screen.findByLabelText(/New workspace name/i),
      'My restored workspace',
    )
    await user.click(screen.getByRole('radio', { name: 'Paste JSON' }))
    await user.click(screen.getByLabelText('Backup JSON'))
    await user.paste(JSON.stringify(validSnapshot))

    await user.click(screen.getByRole('button', { name: 'Import workspace backup' }))
    const dialog = screen.getByRole('dialog', { name: 'Confirm workspace import' })
    expect(within(dialog).getByText(/Yes — set as default workspace/i)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Confirm import' }))

    const summary = await screen.findByRole('region', { name: 'Import summary' })
    expect(within(summary).getByText('My restored workspace')).toBeInTheDocument()
    expect(within(summary).getByText('ID #123')).toBeInTheDocument()
    expect(
      within(summary).queryByRole('button', { name: 'Switch to imported workspace' }),
    ).not.toBeInTheDocument()
    expect(mocks.switchTenant).toHaveBeenCalledWith(123)
  })

  it('blocks invalid JSON and empty workspace name before opening confirmation modal, and warns when metadata.formatVersion is missing or not "1.0"', async () => {
    const user = userEvent.setup()
    const importSpy = vi.spyOn(dataTransferServiceModule, 'importDataTransfer')

    renderDataTransferSettings()

    await user.click(await screen.findByRole('radio', { name: 'Paste JSON' }))
    await user.click(screen.getByLabelText('Backup JSON'))
    await user.paste('{ invalid json syntax ')

    await user.click(screen.getByRole('button', { name: 'Import workspace backup' }))

    expect(screen.getByText('Enter a name for the new workspace.')).toBeInTheDocument()
    expect(
      screen.getByText('Invalid JSON format. Check the backup syntax and try again.'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(importSpy).not.toHaveBeenCalled()

    // Enter workspace name and valid JSON with mismatched formatVersion
    await user.type(screen.getByLabelText(/New workspace name/i), 'Legacy Backup')
    const jsonTextarea = screen.getByLabelText('Backup JSON')
    await user.clear(jsonTextarea)
    await user.click(jsonTextarea)
    await user.paste(JSON.stringify({ metadata: { formatVersion: '0.9' }, expenses: [] }))

    expect(
      await screen.findByText(/Backup formatVersion is "0\.9" \(expected "1\.0"\)/i),
    ).toBeInTheDocument()

    // Non-blocking warning still allows opening confirmation modal
    await user.click(screen.getByRole('button', { name: 'Import workspace backup' }))
    const dialog = screen.getByRole('dialog', { name: 'Confirm workspace import' })
    expect(
      within(dialog).getByText(/Backup formatVersion is "0\.9"/i),
    ).toBeInTheDocument()
  })

  it('handles 409 conflict by displaying "tenant name already exists" and preserving input for retry', async () => {
    const user = userEvent.setup()
    vi.spyOn(dataTransferServiceModule, 'importDataTransfer').mockRejectedValueOnce(
      new ApiClientError('Conflict', 409, { error: 'Conflict' }),
    )

    renderDataTransferSettings()

    const nameInput = await screen.findByLabelText(/New workspace name/i)
    await user.type(nameInput, 'Acme Corp')

    await user.click(screen.getByRole('radio', { name: 'Paste JSON' }))
    await user.click(screen.getByLabelText('Backup JSON'))
    await user.paste(JSON.stringify(validSnapshot))

    await user.click(screen.getByRole('button', { name: 'Import workspace backup' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm import' }),
    )

    const alerts = await screen.findAllByRole('alert')
    expect(
      alerts.some((el) => /tenant name already exists/i.test(el.textContent ?? '')),
    ).toBe(true)
    expect(mocks.toastError).toHaveBeenCalledWith(
      'Import failed',
      expect.stringMatching(/tenant name already exists/i),
    )
    // Preserves entered tenant name so user can adjust and retry
    expect(nameInput).toHaveValue('Acme Corp')
  })

  it('displays server validation errors on 400 and permission errors on 401/403', async () => {
    const user = userEvent.setup()
    const importSpy = vi
      .spyOn(dataTransferServiceModule, 'importDataTransfer')
      .mockRejectedValueOnce(
        new ApiClientError('Bad Request', 400, {
          details: { 'backup.metadata.formatVersion': 'must equal 1.0' },
        }),
      )
      .mockRejectedValueOnce(new ApiClientError('Forbidden', 403))

    renderDataTransferSettings()

    await user.type(await screen.findByLabelText(/New workspace name/i), 'Imported')
    await user.click(screen.getByRole('radio', { name: 'Paste JSON' }))
    await user.click(screen.getByLabelText('Backup JSON'))
    await user.paste(JSON.stringify(validSnapshot))

    // 1) 400 Bad Request
    await user.click(screen.getByRole('button', { name: 'Import workspace backup' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm import' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'backup.metadata.formatVersion: must equal 1.0',
    )

    // 2) 403 Forbidden
    await user.click(screen.getByRole('button', { name: 'Import workspace backup' }))
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Confirm import' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /do not have permission to import workspace data/i,
    )
    expect(importSpy).toHaveBeenCalledTimes(2)
  })
})

