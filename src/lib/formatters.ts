/**
 * Agnostic localization and currency formatting utilities.
 * Does not assume any hardcoded locale or currency, enabling dynamic tenant-specific
 * or user-preference-driven formatting while providing robust defaults.
 */

const FALLBACK_LOCALE = (import.meta.env.VITE_DEFAULT_LOCALE as string) || 'en-US'
const FALLBACK_CURRENCY = (import.meta.env.VITE_DEFAULT_CURRENCY as string) || 'USD'

export interface CurrencyFormatOptions {
  currency?: string
  locale?: string
  minimumFractionDigits?: number
  maximumFractionDigits?: number
  display?: 'symbol' | 'narrowSymbol' | 'code' | 'name'
}

export interface DateFormatOptions extends Intl.DateTimeFormatOptions {
  locale?: string
}

export interface NumberFormatOptions extends Intl.NumberFormatOptions {
  locale?: string
}

/**
 * Resolves the effective locale based on context preference, browser language, or fallback.
 */
export function getEffectiveLocale(preferredLocale?: string): string {
  if (preferredLocale && preferredLocale.trim().length > 0) {
    return preferredLocale
  }
  if (typeof navigator !== 'undefined' && navigator.language) {
    return navigator.language
  }
  return FALLBACK_LOCALE
}

/**
 * Resolves the effective currency based on context preference or fallback.
 */
export function getEffectiveCurrency(preferredCurrency?: string): string {
  if (preferredCurrency && preferredCurrency.trim().length > 0) {
    return preferredCurrency.toUpperCase()
  }
  return FALLBACK_CURRENCY
}

/**
 * Formats a monetary amount into a localized currency string.
 */
export function formatCurrency(
  amount: number,
  options: CurrencyFormatOptions = {},
): string {
  const {
    currency,
    locale,
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    display = 'symbol',
  } = options

  const effectiveLocale = getEffectiveLocale(locale)
  const effectiveCurrency = getEffectiveCurrency(currency)

  try {
    return new Intl.NumberFormat(effectiveLocale, {
      style: 'currency',
      currency: effectiveCurrency,
      currencyDisplay: display,
      minimumFractionDigits,
      maximumFractionDigits,
    }).format(amount)
  } catch (error) {
    console.warn(`[formatCurrency] Failed to format with currency "${effectiveCurrency}" and locale "${effectiveLocale}". Using fallback.`, error)
    return `${effectiveCurrency} ${amount.toFixed(minimumFractionDigits)}`
  }
}

/** Formats a workspace-denominated amount without performing currency conversion. */
export function formatTenantCurrency(
  amount: number,
  tenant: { currency: string; locale: string },
): string {
  return formatCurrency(amount, { currency: tenant.currency, locale: tenant.locale })
}

/**
 * Formats a date using localized conventions without assuming layout.
 */
export function formatDate(
  value: Date | string | number | null | undefined,
  options: DateFormatOptions = {},
): string {
  if (!value) return '—'

  const { locale, dateStyle = 'medium', ...rest } = options
  const effectiveLocale = getEffectiveLocale(locale)
  const dateObj = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(dateObj.getTime())) {
    return 'Invalid Date'
  }

  try {
    return new Intl.DateTimeFormat(effectiveLocale, {
      dateStyle,
      ...rest,
    }).format(dateObj)
  } catch (error) {
    console.warn(`[formatDate] Failed formatting date with locale "${effectiveLocale}".`, error)
    return dateObj.toLocaleDateString()
  }
}

/**
 * Formats standard numbers with localized thousand and decimal separators.
 */
export function formatNumber(
  value: number,
  options: NumberFormatOptions = {},
): string {
  const { locale, ...rest } = options
  const effectiveLocale = getEffectiveLocale(locale)

  try {
    return new Intl.NumberFormat(effectiveLocale, rest).format(value)
  } catch {
    return value.toString()
  }
}
