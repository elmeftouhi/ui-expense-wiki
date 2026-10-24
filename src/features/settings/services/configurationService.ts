import { apiClient } from '@/api/client'
import { configurationRequestSchema, configurationResponseSchema } from '../schemas/configurationSchema'
import type { TenantConfigurationRequest } from '../types'

function parseResponse(raw: unknown, tenantId: number | string) {
  const parsed = configurationResponseSchema.safeParse(raw)
  if (!parsed.success || String(parsed.data.tenantId) !== String(tenantId)) {
    throw new Error('The server returned invalid workspace settings. Reload settings or contact support.')
  }
  return parsed.data
}

export const configurationService = {
  async get(tenantId: number | string, signal?: AbortSignal) {
    return parseResponse(
      await apiClient.get<unknown>('/v1/config', { tenantId, signal }),
      tenantId,
    )
  },
  async update(tenantId: number | string, payload: TenantConfigurationRequest) {
    return parseResponse(
      await apiClient.put<unknown>('/v1/config', configurationRequestSchema.parse(payload), { tenantId }),
      tenantId,
    )
  },
}
