import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/api/client'
import { configurationService } from '../services/configurationService'
import { configurationFormSchema, toConfigurationRequest, toFormValues } from '../schemas/configurationSchema'
import { configuration } from './configurationFixtures'

afterEach(() => vi.restoreAllMocks())

describe('configuration API', () => {
  it('loads and updates the current tenant using only editable fields', async () => {
    const get = vi.spyOn(apiClient, 'get').mockResolvedValue(configuration)
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue(configuration)
    const signal = new AbortController().signal
    const payload = toConfigurationRequest(toFormValues(configuration))
    await expect(configurationService.get(1, signal)).resolves.toEqual(configuration)
    await expect(configurationService.update(1, { ...configuration, ...payload })).resolves.toEqual(configuration)
    expect(get).toHaveBeenCalledWith('/v1/config', { tenantId: 1, signal })
    expect(put).toHaveBeenCalledWith('/v1/config', payload, { tenantId: 1 })
    expect(Object.keys(payload)).toHaveLength(12)
    expect(payload).not.toHaveProperty('id')
    expect(payload).not.toHaveProperty('tenantId')
    expect(payload).not.toHaveProperty('createdAt')
  })

  it('round-trips encoded lists and retains undocumented server values', () => {
    const form = toFormValues({ ...configuration, notificationChannels: '["IN_APP","CUSTOM"]' })
    expect(form.notificationChannels).toBe('IN_APP, CUSTOM')
    expect(form.autoPaymentReminderDays).toBe('3, 7')
    expect(toConfigurationRequest(form)).toMatchObject({
      notificationChannels: '["IN_APP","CUSTOM"]', autoPaymentReminderDays: '[3,7]',
    })
    expect(toConfigurationRequest({ ...form, notificationChannels: '', autoPaymentReminderDays: '' }))
      .toMatchObject({ notificationChannels: '[]', autoPaymentReminderDays: '[]' })
  })

  it.each(['-1', '3.5', '3,,7', 'foo', '1e2', '2147483648'])('rejects invalid reminder days: %s', (value) => {
    expect(configurationFormSchema.safeParse({ ...toFormValues(configuration), autoPaymentReminderDays: value }).success).toBe(false)
  })

  it.each([
    { decimalPlaces: -1 }, { decimalPlaces: 1.5 }, { decimalPlaces: NaN },
    { budgetAlertThreshold: 101 }, { budgetAlertThreshold: -1 }, { timezone: ' ' },
    { notificationChannels: 'IN_APP,' },
  ])('rejects invalid input %j', (patch) => {
    expect(configurationFormSchema.safeParse({ ...toFormValues(configuration), ...patch }).success).toBe(false)
  })

  it.each([
    { tenantId: 2 }, { notificationChannels: 'not json' }, { notificationChannels: '{}' },
    { autoPaymentReminderDays: '["3"]' }, { autoPaymentReminderDays: '[-1]' }, { currency: 'invalid' },
  ])('surfaces invalid or cross-tenant responses %j', async (patch) => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ ...configuration, ...patch })
    await expect(configurationService.get(1)).rejects.toThrow('invalid workspace settings')
  })

  it('propagates request failures without claiming success', async () => {
    vi.spyOn(apiClient, 'put').mockRejectedValue(new Error('Update failed'))
    await expect(configurationService.update(1, toConfigurationRequest(toFormValues(configuration))))
      .rejects.toThrow('Update failed')
  })
})
