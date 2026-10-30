import type {
  Budget,
  BudgetHealth,
  BudgetPeriod,
  BudgetPeriodicity,
  BudgetPeriodSummary,
  BudgetWarningType,
} from '../types'

export const PERIODICITY_LABELS: Record<BudgetPeriodicity, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUAL: 'Annual',
}

/**
 * Parses an ISO `yyyy-MM-dd` date as a *local* calendar date.
 * (`new Date('2026-10-01')` is UTC midnight and renders as Sep 30 in negative-offset zones.)
 */
export function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return new Date(value)
  const [, y, m, d] = match
  return new Date(Number(y), Number(m) - 1, Number(d))
}

/** Absolute spend amount at which the warning fires. */
export function getWarningAmount(
  allocated: number,
  warningType: BudgetWarningType,
  threshold: number,
): number {
  return warningType === 'PERCENTAGE' ? (allocated * threshold) / 100 : threshold
}

export function summarizePeriod(period: BudgetPeriod): BudgetPeriodSummary {
  const allocated = period.allocatedAmount
  const spent = period.spentAmount
  const remaining = allocated - spent
  const consumedPercent = allocated > 0 ? (spent / allocated) * 100 : spent > 0 ? Infinity : 0
  const warningAt = getWarningAmount(allocated, period.warningType, period.warningThreshold)

  let health: BudgetPeriodSummary['health'] = 'ON_TRACK'
  if (spent > allocated) health = 'EXCEEDED'
  else if (spent >= warningAt) health = 'WARNING'

  return { allocated, spent, remaining, consumedPercent, warningAt, health }
}

export function getBudgetHealth(budget: Budget): BudgetHealth {
  return budget.currentPeriod ? summarizePeriod(budget.currentPeriod).health : 'NO_PERIOD'
}

export function formatPeriodLabel(
  period: Pick<BudgetPeriod, 'startDate' | 'endDate'>,
  periodicity: BudgetPeriodicity,
  locale?: string,
): string {
  const start = parseIsoDate(period.startDate)
  const end = parseIsoDate(period.endDate)
  if (Number.isNaN(start.getTime())) return '—'

  switch (periodicity) {
    case 'MONTHLY':
      return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(start)
    case 'QUARTERLY': {
      const isCalendarQuarter = start.getMonth() % 3 === 0 && start.getDate() === 1
      if (isCalendarQuarter) {
        return `Q${Math.floor(start.getMonth() / 3) + 1} ${start.getFullYear()}`
      }
      return formatDateRange(period, locale)
    }
    case 'ANNUAL':
      if (start.getMonth() === 0 && start.getDate() === 1) return String(start.getFullYear())
      return `FY ${start.getFullYear()}/${String(end.getFullYear()).slice(-2)}`
    default:
      return formatDateRange(period, locale)
  }
}

export function formatDateRange(
  period: Pick<BudgetPeriod, 'startDate' | 'endDate'>,
  locale?: string,
): string {
  const start = parseIsoDate(period.startDate)
  const end = parseIsoDate(period.endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '—'
  const fmt = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt.format(start)} – ${fmt.format(end)}`
}

/** Newest period first. */
export function sortPeriodsDesc(periods: BudgetPeriod[]): BudgetPeriod[] {
  return [...periods].sort((a, b) => b.startDate.localeCompare(a.startDate))
}

export interface BudgetPortfolioSummary {
  totalBudgets: number
  activeBudgets: number
  /** Budgets with an existing current period instance. */
  trackedBudgets: number
  totalAllocated: number
  totalSpent: number
  totalRemaining: number
  consumedPercent: number
  counts: Record<BudgetHealth, number>
}

/** Aggregates current-period figures across budgets for the list page KPIs. */
export function summarizePortfolio(budgets: Budget[]): BudgetPortfolioSummary {
  const counts: Record<BudgetHealth, number> = { NO_PERIOD: 0, ON_TRACK: 0, WARNING: 0, EXCEEDED: 0 }
  let totalAllocated = 0
  let totalSpent = 0
  let trackedBudgets = 0
  let activeBudgets = 0

  for (const budget of budgets) {
    if (budget.active) activeBudgets++
    counts[getBudgetHealth(budget)]++
    if (budget.currentPeriod) {
      trackedBudgets++
      totalAllocated += budget.currentPeriod.allocatedAmount
      totalSpent += budget.currentPeriod.spentAmount
    }
  }

  return {
    totalBudgets: budgets.length,
    activeBudgets,
    trackedBudgets,
    totalAllocated,
    totalSpent,
    totalRemaining: totalAllocated - totalSpent,
    consumedPercent: totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0,
    counts,
  }
}

/** Short month label for history rows, e.g. "Oct 2026"; falls back to a date range for multi-month spans. */
export function formatHistoryPeriodLabel(
  period: Pick<BudgetPeriod, 'startDate' | 'endDate'>,
  locale?: string,
): string {
  const start = parseIsoDate(period.startDate)
  const end = parseIsoDate(period.endDate)
  if (Number.isNaN(start.getTime())) return '—'
  const sameMonth =
    Number.isNaN(end.getTime()) ||
    (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth())
  if (!sameMonth) return formatDateRange(period, locale)
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(start)
}

/** Compact warning threshold: "80%" for percentage rules, a currency amount otherwise. */
export function formatWarningThreshold(
  warningType: BudgetWarningType,
  threshold: number,
  formatMoney: (n: number) => string,
): string {
  return warningType === 'PERCENTAGE' ? `${threshold}%` : formatMoney(threshold)
}

export function describeWarningRule(
  warningType: BudgetWarningType,
  threshold: number,
  formatMoney: (n: number) => string,
): string {
  return warningType === 'PERCENTAGE'
    ? `Warn at ${threshold}% of allocation`
    : `Warn when spend reaches ${formatMoney(threshold)}`
}
