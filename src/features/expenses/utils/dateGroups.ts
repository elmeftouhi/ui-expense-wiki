import { formatDate } from '@/lib/formatters'
import type { ExpenseResponse, ExpenseSortField } from '../types'

export interface ExpenseDateGroup {
  dateKey: string
  label: string
  subtotal: number | null
  currency: string
  items: ExpenseResponse[]
}

export function localTodayIso(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function parseUtcDateOnly(isoDate: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate)
  if (!match) return null
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

export function diffDaysFromToday(isoDate: string, todayIso = localTodayIso()): number | null {
  const target = parseUtcDateOnly(isoDate)
  const base = parseUtcDateOnly(todayIso)
  if (target === null || base === null) return null
  return Math.round((target - base) / 86_400_000)
}

export function formatDayGroupHeading(
  dateKey: string,
  locale: string,
  todayIso = localTodayIso(),
): string {
  const diff = diffDaysFromToday(dateKey, todayIso)
  const utcMs = parseUtcDateOnly(dateKey)
  if (utcMs === null) return dateKey

  const todayYear = Number(todayIso.slice(0, 4))
  const targetYear = Number(dateKey.slice(0, 4))
  const shortDate = new Intl.DateTimeFormat(locale, {
    month: 'short',
    day: 'numeric',
    ...(targetYear !== todayYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(utcMs))

  if (diff === 0) return `Today · ${shortDate}`
  if (diff === -1) return `Yesterday · ${shortDate}`
  if (diff === 1) return `Tomorrow · ${shortDate}`

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(targetYear !== todayYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(utcMs))
}

export function isDateSorted(sort?: ExpenseSortField): boolean {
  return !sort || sort === 'dueDate' || sort === 'createdAt'
}

export function groupExpensesByDate(
  expenses: ExpenseResponse[],
  options: {
    sort?: ExpenseSortField
    locale: string
    tenantCurrency: string
    todayIso?: string
  },
): ExpenseDateGroup[] {
  const { sort, locale, tenantCurrency, todayIso = localTodayIso() } = options
  const groups: ExpenseDateGroup[] = []
  const byKey = new Map<string, ExpenseDateGroup>()

  for (const expense of expenses) {
    const rawDate = sort === 'createdAt' ? expense.createdAt.slice(0, 10) : expense.dueDate
    const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : expense.dueDate
    let group = byKey.get(dateKey)
    if (!group) {
      group = {
        dateKey,
        label: formatDayGroupHeading(dateKey, locale, todayIso),
        subtotal: 0,
        currency: expense.currency || tenantCurrency,
        items: [],
      }
      byKey.set(dateKey, group)
      groups.push(group)
    }
    group.items.push(expense)
    if (group.subtotal !== null) {
      if (expense.currency === group.currency) {
        group.subtotal += expense.amount
      } else {
        group.subtotal = null
      }
    }
  }

  return groups
}

export interface ExpenseDateCue {
  primary: string
  secondary?: string
  relativeCue?: string
  tone: 'urgent' | 'soon' | 'muted'
}

export function getExpenseDateCue(
  expense: ExpenseResponse,
  locale: string,
  todayIso = localTodayIso(),
): ExpenseDateCue {
  const dueFormatted = formatDate(expense.dueDate, { locale, timeZone: 'UTC' })
  const paidFormatted = expense.paidDate ? formatDate(expense.paidDate, { locale, timeZone: 'UTC' }) : undefined
  const diff = diffDaysFromToday(expense.dueDate, todayIso)

  if (expense.status === 'PAID') {
    if (expense.paidDate && expense.paidDate === expense.dueDate) {
      return { primary: dueFormatted, secondary: 'Settled', tone: 'muted' }
    }
    return {
      primary: dueFormatted,
      secondary: paidFormatted ? `Paid ${paidFormatted}` : undefined,
      tone: 'muted',
    }
  }

  if (expense.status === 'OVERDUE' || (expense.status === 'PENDING' && diff !== null && diff < 0)) {
    const daysLate = diff !== null ? Math.abs(diff) : 0
    return {
      primary: `Due ${dueFormatted}`,
      relativeCue: daysLate === 1 ? '1d overdue' : daysLate > 1 ? `${daysLate}d overdue` : 'Past due',
      tone: 'urgent',
    }
  }

  if (expense.status === 'PENDING' && diff !== null) {
    if (diff === 0) {
      return { primary: `Due ${dueFormatted}`, relativeCue: 'Due today', tone: 'soon' }
    }
    if (diff === 1) {
      return { primary: `Due ${dueFormatted}`, relativeCue: 'Due tomorrow', tone: 'soon' }
    }
    if (diff > 1 && diff <= 7) {
      return { primary: `Due ${dueFormatted}`, relativeCue: `Due in ${diff}d`, tone: 'soon' }
    }
  }

  return {
    primary: `Due ${dueFormatted}`,
    secondary: paidFormatted ? `Paid ${paidFormatted}` : undefined,
    tone: 'muted',
  }
}

