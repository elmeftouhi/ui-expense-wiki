import { describe, expect, it } from 'vitest'
import { formatTenantCurrency } from './formatters'

describe('formatTenantCurrency', () => {
  it('uses the configured tenant currency and locale', () => {
    expect(formatTenantCurrency(1234.5, { currency: 'EUR', locale: 'en-US' })).toBe('€1,234.50')
    expect(formatTenantCurrency(1234.5, { currency: 'EUR', locale: 'de-DE' }))
      .toBe(new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(1234.5))
  })

  it('formats zero and negative amounts without converting their numeric value', () => {
    expect(formatTenantCurrency(0, { currency: 'EUR', locale: 'en-US' })).toBe('€0.00')
    expect(formatTenantCurrency(-45, { currency: 'EUR', locale: 'en-US' })).toBe('-€45.00')
  })
})
