/**
 * Returns the narrow currency symbol for a currency/locale pair (e.g. "$", "€", "₩").
 * Falls back to the ISO code when Intl cannot resolve it.
 */
export function getCurrencySymbol(currency: string, locale?: string): string {
  try {
    const part = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((p) => p.type === 'currency')
    return part?.value ?? currency
  } catch {
    return currency
  }
}
