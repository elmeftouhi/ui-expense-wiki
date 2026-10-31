import { apiClient } from '@/api/client'
import {
  importUserDataRequestSchema,
  importUserDataResponseSchema,
  userDataBackupSnapshotSchema,
} from '../schemas/dataTransferSchema'
import type {
  ImportUserDataRequest,
  ImportUserDataResponse,
  UserDataBackupSnapshot,
} from '../types'

export interface DataTransferRequestOptions {
  tenantId?: number | string | null
  signal?: AbortSignal
}

/**
 * Exports full workspace backup JSON for the selected tenant.
 * Endpoint: GET /v1/data-transfer/export
 */
export async function exportDataTransfer(
  options?: DataTransferRequestOptions,
): Promise<UserDataBackupSnapshot> {
  const raw = await apiClient.get<unknown>('/v1/data-transfer/export', {
    tenantId: options?.tenantId,
    signal: options?.signal,
  })
  const parsed = userDataBackupSnapshotSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error('The server returned an invalid workspace backup snapshot.')
  }
  return parsed.data
}

/**
 * Creates a new tenant/workspace and imports a backup snapshot into it.
 * Endpoint: POST /v1/data-transfer/import
 */
export async function importDataTransfer(
  payload: ImportUserDataRequest,
  options?: DataTransferRequestOptions,
): Promise<ImportUserDataResponse> {
  const validatedPayload = importUserDataRequestSchema.parse(payload)
  const raw = await apiClient.post<unknown>('/v1/data-transfer/import', validatedPayload, {
    tenantId: options?.tenantId,
    signal: options?.signal,
  })
  const parsed = importUserDataResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new Error('The server returned an invalid import summary response.')
  }
  return parsed.data
}

export const dataTransferService = {
  exportDataTransfer,
  importDataTransfer,
}

