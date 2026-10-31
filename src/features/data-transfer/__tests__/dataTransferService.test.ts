import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient, ApiClientError } from '@/api/client'
import {
  exportDataTransfer,
  importDataTransfer,
} from '../services/dataTransferService'
import {
  buildBackupFilename,
  getImportErrorMessage,
  inspectBackupJson,
} from '../utils/backupUtils'
import type { ImportUserDataResponse, UserDataBackupSnapshot } from '../types'

const sampleSnapshot: UserDataBackupSnapshot = {
  metadata: {
    formatVersion: '1.0',
    exportedAt: '2026-10-31T22:00:00Z',
    tenantName: 'Acme Corp',
  },
  categories: [{ id: 1, name: 'Travel' }],
  expenses: [{ id: 10, amount: 120 }],
}

const sampleImportResponse: ImportUserDataResponse = {
  tenantId: 123,
  tenantName: 'My restored workspace',
  switchedDefaultTenant: true,
  counts: {
    exercices: 1,
    categories: 4,
    paymentMethods: 2,
    budgets: 3,
    budgetPeriodInstances: 6,
    subscriptions: 2,
    expenses: 18,
    subscriptionPayments: 5,
    notifications: 7,
    activityLogs: 25,
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('dataTransferService', () => {
  it('calls GET /v1/data-transfer/export and returns the backup snapshot', async () => {
    const getSpy = vi.spyOn(apiClient, 'get').mockResolvedValue(sampleSnapshot)

    const result = await exportDataTransfer({ tenantId: 7 })

    expect(getSpy).toHaveBeenCalledWith('/v1/data-transfer/export', {
      tenantId: 7,
      signal: undefined,
    })
    expect(result).toEqual(sampleSnapshot)
  })

  it('rejects non-object export payloads', async () => {
    vi.spyOn(apiClient, 'get').mockResolvedValue(['unexpected-array'])

    await expect(exportDataTransfer()).rejects.toThrow(
      /invalid workspace backup snapshot/i,
    )
  })

  it('calls POST /v1/data-transfer/import with trimmed tenantName and backup payload', async () => {
    const postSpy = vi.spyOn(apiClient, 'post').mockResolvedValue(sampleImportResponse)

    const result = await importDataTransfer({
      tenantName: '  My restored workspace  ',
      switchDefaultTenant: true,
      backup: sampleSnapshot,
    })

    expect(postSpy).toHaveBeenCalledWith(
      '/v1/data-transfer/import',
      {
        tenantName: 'My restored workspace',
        switchDefaultTenant: true,
        backup: sampleSnapshot,
      },
      { tenantId: undefined, signal: undefined },
    )
    expect(result).toEqual(sampleImportResponse)
  })

  it('rejects malformed import responses', async () => {
    vi.spyOn(apiClient, 'post').mockResolvedValue({ tenantId: 'not-a-number' })

    await expect(
      importDataTransfer({
        tenantName: 'Restored',
        switchDefaultTenant: false,
        backup: sampleSnapshot,
      }),
    ).rejects.toThrow(/invalid import summary response/i)
  })
})

describe('backupUtils', () => {
  it('builds sanitized backup filenames matching expense-backup-{tenantName}-{yyyyMMdd-HHmmss}.json', () => {
    const fixedDate = new Date(2026, 9, 31, 14, 5, 9) // 2026-10-31 14:05:09
    expect(buildBackupFilename('Acme Corp / HQ!', fixedDate)).toBe(
      'expense-backup-acme-corp-hq-20261031-140509.json',
    )
    expect(buildBackupFilename('   ', fixedDate)).toBe(
      'expense-backup-workspace-20261031-140509.json',
    )
  })

  it('validates JSON syntax, root object type, and metadata.formatVersion', () => {
    expect(inspectBackupJson('   ')).toEqual({
      ok: false,
      error: 'Provide a backup JSON file or paste backup JSON.',
    })

    expect(inspectBackupJson('{bad json')).toEqual({
      ok: false,
      error: 'Invalid JSON format. Check the backup syntax and try again.',
    })

    expect(inspectBackupJson('[1, 2, 3]')).toEqual({
      ok: false,
      error: 'Invalid backup structure. The root value must be a JSON object.',
    })

    const missingVersion = inspectBackupJson(JSON.stringify({ expenses: [{}, {}] }))
    expect(missingVersion.ok).toBe(true)
    if (missingVersion.ok) {
      expect(missingVersion.formatWarning).toMatch(/formatVersion is missing/i)
      expect(missingVersion.estimatedRecords).toBe(2)
    }

    const wrongVersion = inspectBackupJson(
      JSON.stringify({ metadata: { formatVersion: '2.0' } }),
    )
    expect(wrongVersion.ok).toBe(true)
    if (wrongVersion.ok) {
      expect(wrongVersion.formatWarning).toMatch(/formatVersion is "2\.0"/i)
    }

    const valid = inspectBackupJson(JSON.stringify(sampleSnapshot))
    expect(valid.ok).toBe(true)
    if (valid.ok) {
      expect(valid.formatWarning).toBeNull()
      expect(valid.formatVersion).toBe('1.0')
      expect(valid.sourceTenantName).toBe('Acme Corp')
    }
  })

  it('maps HTTP status codes 400, 401, 403, 409, and generic failures to actionable messages', () => {
    expect(
      getImportErrorMessage(
        new ApiClientError('Bad Request', 400, { message: 'Unsupported formatVersion 0.5' }),
      ),
    ).toBe('Unsupported formatVersion 0.5')

    expect(getImportErrorMessage(new ApiClientError('Unauthorized', 401))).toMatch(
      /authentication required/i,
    )

    expect(getImportErrorMessage(new ApiClientError('Forbidden', 403))).toMatch(
      /permission/i,
    )

    expect(
      getImportErrorMessage(new ApiClientError('Conflict', 409, { error: 'Conflict' })),
    ).toMatch(/tenant name already exists/i)

    expect(getImportErrorMessage(new ApiClientError('Server Error', 500))).toBe(
      'Unable to import workspace backup. Please try again.',
    )
  })
})

