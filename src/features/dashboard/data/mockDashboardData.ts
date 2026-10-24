import type { DashboardData } from '../types'

export const MOCK_DASHBOARD_BY_TENANT: Record<string | number, DashboardData> = {
  // 101: Acme Corporation (USD)
  101: {
    tenantId: 101,
    currency: 'USD',
    kpis: {
      thisMonth: {
        currentAmount: 18450.0,
        previousAmount: 16980.0,
        difference: 1470.0,
        percentageChange: 8.65,
        trend: 'up',
        periodLabel: 'vs last month ($16,980.00)',
      },
      thisYear: {
        currentAmount: 148200.0,
        previousAmount: 136500.0,
        difference: 11700.0,
        percentageChange: 8.57,
        trend: 'up',
        periodLabel: 'vs 2025 YTD ($136,500.00)',
      },
      upcomingExpenses: {
        totalAmount: 4620.0,
        count: 5,
        nextDueDate: '2026-10-18T00:00:00Z',
        nextItemTitle: 'AWS Cloud Hosting',
      },
      pendingApprovals: {
        totalAmount: 2340.5,
        count: 3,
      },
      budgetUtilization: {
        monthlyBudget: 25000.0,
        spent: 18450.0,
        remaining: 6550.0,
        percentage: 73.8,
      },
      overdue: {
        totalAmount: 450.0,
        count: 1,
      },
    },
    upcomingList: [
      {
        id: 'UP-101',
        title: 'AWS Cloud Infrastructure',
        category: 'Software & Infrastructure',
        dueDate: '2026-10-18T00:00:00Z',
        amount: 1450.0,
        vendor: 'Amazon Web Services',
        isRecurring: true,
        status: 'AUTO_PAY',
      },
      {
        id: 'UP-102',
        title: 'Figma Enterprise License',
        category: 'Software & Infrastructure',
        dueDate: '2026-10-22T00:00:00Z',
        amount: 720.0,
        vendor: 'Figma, Inc.',
        isRecurring: true,
        status: 'SCHEDULED',
      },
      {
        id: 'UP-103',
        title: 'WeWork Office Space Rent',
        category: 'Office & Facilities',
        dueDate: '2026-10-25T00:00:00Z',
        amount: 1850.0,
        vendor: 'WeWork Management',
        isRecurring: true,
        status: 'SCHEDULED',
      },
      {
        id: 'UP-104',
        title: 'Google Workspace Enterprise',
        category: 'Software & Infrastructure',
        dueDate: '2026-10-28T00:00:00Z',
        amount: 360.0,
        vendor: 'Google Cloud',
        isRecurring: true,
        status: 'AUTO_PAY',
      },
      {
        id: 'UP-105',
        title: 'Legal Counsel Retainer',
        category: 'Professional Services',
        dueDate: '2026-10-31T00:00:00Z',
        amount: 240.0,
        vendor: 'Morrison & Partners LLP',
        isRecurring: false,
        status: 'PENDING',
      },
    ],
    monthlyTrends: [
      { month: 'May', currentYear: 14200, previousYear: 13100, budget: 22000 },
      { month: 'Jun', currentYear: 15800, previousYear: 14200, budget: 22000 },
      { month: 'Jul', currentYear: 13900, previousYear: 14800, budget: 24000 },
      { month: 'Aug', currentYear: 17100, previousYear: 15400, budget: 24000 },
      { month: 'Sep', currentYear: 16980, previousYear: 15900, budget: 25000 },
      { month: 'Oct', currentYear: 18450, previousYear: 16400, budget: 25000 },
    ],
    categoryBreakdown: [
      { categoryId: 1, categoryName: 'Software & Infrastructure', amount: 7600, color: '#3b82f6', percentage: 41.2 },
      { categoryId: 2, categoryName: 'Office & Facilities', amount: 4800, color: '#10b981', percentage: 26.0 },
      { categoryId: 3, categoryName: 'Travel & Dining', amount: 3250, color: '#f59e0b', percentage: 17.6 },
      { categoryId: 4, categoryName: 'Marketing & Sales', amount: 1950, color: '#8b5cf6', percentage: 10.6 },
      { categoryId: 5, categoryName: 'Other Expenses', amount: 850, color: '#64748b', percentage: 4.6 },
    ],
  },

  // 102: Nexus Global Labs (EUR)
  102: {
    tenantId: 102,
    currency: 'EUR',
    kpis: {
      thisMonth: {
        currentAmount: 32800.0,
        previousAmount: 34950.0,
        difference: -2150.0,
        percentageChange: -6.15,
        trend: 'down',
        periodLabel: 'vs last month (€34,950.00)',
      },
      thisYear: {
        currentAmount: 284600.0,
        previousAmount: 262000.0,
        difference: 22600.0,
        percentageChange: 8.62,
        trend: 'up',
        periodLabel: 'vs 2025 YTD (€262,000.00)',
      },
      upcomingExpenses: {
        totalAmount: 8400.0,
        count: 7,
        nextDueDate: '2026-10-17T00:00:00Z',
        nextItemTitle: 'Datacenter Server Lease',
      },
      pendingApprovals: {
        totalAmount: 4850.0,
        count: 5,
      },
      budgetUtilization: {
        monthlyBudget: 40000.0,
        spent: 32800.0,
        remaining: 7200.0,
        percentage: 82.0,
      },
      overdue: {
        totalAmount: 0.0,
        count: 0,
      },
    },
    upcomingList: [
      {
        id: 'UP-201',
        title: 'Datacenter Server Lease',
        category: 'Hardware & Infrastructure',
        dueDate: '2026-10-17T00:00:00Z',
        amount: 3200.0,
        vendor: 'Hetzner Online GmbH',
        isRecurring: true,
        status: 'AUTO_PAY',
      },
      {
        id: 'UP-202',
        title: 'SAP Cloud Enterprise ERP',
        category: 'Business Systems',
        dueDate: '2026-10-20T00:00:00Z',
        amount: 2800.0,
        vendor: 'SAP SE',
        isRecurring: true,
        status: 'SCHEDULED',
      },
      {
        id: 'UP-203',
        title: 'Munich Research Lab Rent',
        category: 'Facilities & Labs',
        dueDate: '2026-10-25T00:00:00Z',
        amount: 2400.0,
        vendor: 'Campus Tech Park',
        isRecurring: true,
        status: 'SCHEDULED',
      },
    ],
    monthlyTrends: [
      { month: 'May', currentYear: 28900, previousYear: 26500, budget: 38000 },
      { month: 'Jun', currentYear: 31200, previousYear: 28100, budget: 38000 },
      { month: 'Jul', currentYear: 29500, previousYear: 27900, budget: 38000 },
      { month: 'Aug', currentYear: 33100, previousYear: 30200, budget: 40000 },
      { month: 'Sep', currentYear: 34950, previousYear: 31800, budget: 40000 },
      { month: 'Oct', currentYear: 32800, previousYear: 32100, budget: 40000 },
    ],
    categoryBreakdown: [
      { categoryId: 1, categoryName: 'Hardware & Infrastructure', amount: 14200, color: '#3b82f6', percentage: 43.3 },
      { categoryId: 2, categoryName: 'Facilities & Labs', amount: 8900, color: '#10b981', percentage: 27.1 },
      { categoryId: 3, categoryName: 'Business Systems', amount: 5600, color: '#8b5cf6', percentage: 17.1 },
      { categoryId: 4, categoryName: 'Travel & Conferences', amount: 4100, color: '#f59e0b', percentage: 12.5 },
    ],
  },

  // 103: Nordic Studio (SEK)
  103: {
    tenantId: 103,
    currency: 'SEK',
    kpis: {
      thisMonth: {
        currentAmount: 145000.0,
        previousAmount: 138000.0,
        difference: 7000.0,
        percentageChange: 5.07,
        trend: 'up',
        periodLabel: 'vs last month (138 000,00 kr)',
      },
      thisYear: {
        currentAmount: 1240000.0,
        previousAmount: 1190000.0,
        difference: 50000.0,
        percentageChange: 4.2,
        trend: 'up',
        periodLabel: 'vs 2025 YTD (1 190 000,00 kr)',
      },
      upcomingExpenses: {
        totalAmount: 32000.0,
        count: 4,
        nextDueDate: '2026-10-21T00:00:00Z',
        nextItemTitle: 'Stockholm Studio Lease',
      },
      pendingApprovals: {
        totalAmount: 18500.0,
        count: 2,
      },
      budgetUtilization: {
        monthlyBudget: 200000.0,
        spent: 145000.0,
        remaining: 55000.0,
        percentage: 72.5,
      },
      overdue: {
        totalAmount: 0.0,
        count: 0,
      },
    },
    upcomingList: [
      {
        id: 'UP-301',
        title: 'Stockholm Studio Lease',
        category: 'Office & Facilities',
        dueDate: '2026-10-21T00:00:00Z',
        amount: 22000.0,
        vendor: 'Atrium Ljungberg Fastigheter',
        isRecurring: true,
        status: 'SCHEDULED',
      },
      {
        id: 'UP-302',
        title: 'Creative Cloud Team Licenses',
        category: 'Design & Software',
        dueDate: '2026-10-27T00:00:00Z',
        amount: 10000.0,
        vendor: 'Adobe Systems Nordic',
        isRecurring: true,
        status: 'AUTO_PAY',
      },
    ],
    monthlyTrends: [
      { month: 'May', currentYear: 118000, previousYear: 110000, budget: 180000 },
      { month: 'Jun', currentYear: 129000, previousYear: 122000, budget: 180000 },
      { month: 'Jul', currentYear: 98000, previousYear: 105000, budget: 180000 },
      { month: 'Aug', currentYear: 132000, previousYear: 128000, budget: 200000 },
      { month: 'Sep', currentYear: 138000, previousYear: 131000, budget: 200000 },
      { month: 'Oct', currentYear: 145000, previousYear: 136000, budget: 200000 },
    ],
    categoryBreakdown: [
      { categoryId: 1, categoryName: 'Design & Software', amount: 62000, color: '#3b82f6', percentage: 42.8 },
      { categoryId: 2, categoryName: 'Office & Facilities', amount: 48000, color: '#10b981', percentage: 33.1 },
      { categoryId: 3, categoryName: 'Freelance & Contracting', amount: 24000, color: '#8b5cf6', percentage: 16.5 },
      { categoryId: 4, categoryName: 'Travel & Transport', amount: 11000, color: '#f59e0b', percentage: 7.6 },
    ],
  },
}

export function getDashboardDataForTenant(tenantId: string | number): DashboardData {
  return MOCK_DASHBOARD_BY_TENANT[tenantId] ?? MOCK_DASHBOARD_BY_TENANT[101]
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const MONTH_FULL_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export const AVAILABLE_YEARS = [2026, 2025, 2024]

export interface MonthOption {
  year: number
  month: number // 1-12
  label: string
}

export const AVAILABLE_MONTHS: MonthOption[] = [
  { year: 2026, month: 10, label: 'October 2026' },
  { year: 2026, month: 9, label: 'September 2026' },
  { year: 2026, month: 8, label: 'August 2026' },
  { year: 2026, month: 7, label: 'July 2026' },
  { year: 2026, month: 6, label: 'June 2026' },
  { year: 2026, month: 5, label: 'May 2026' },
]

export function getMonthlyDataForYear(
  tenantId: string | number,
  year: number,
): Array<{
  month: string
  shortMonth: string
  monthIndex: number
  amount: number
  previousYearAmount: number
  budget: number
}> {
  const tid = Number(tenantId)
  // Base scale factors
  const multiplier = tid === 103 ? 7.86 : tid === 102 ? 1.78 : 1.0

  // 2026 base amounts per month
  const base2026 = [13500, 14100, 13800, 14600, 14200, 15800, 13900, 17100, 16980, 18450, 15200, 16500]
  // 2025 base amounts per month
  const base2025 = [12000, 12500, 12800, 13200, 13100, 14200, 14800, 15400, 15900, 16400, 14200, 15000]
  // 2024 base amounts per month
  const base2024 = [10500, 11200, 11800, 12100, 12400, 12900, 13200, 13600, 14100, 14500, 13800, 14200]
  // 2023 base amounts (for 2024 comparison)
  const base2023 = [9400, 9900, 10200, 10500, 10800, 11200, 11500, 11900, 12200, 12600, 12100, 12500]

  let currentAmounts: number[]
  let prevAmounts: number[]
  let budgetBase: number

  if (year === 2026) {
    currentAmounts = base2026
    prevAmounts = base2025
    budgetBase = 25000
  } else if (year === 2025) {
    currentAmounts = base2025
    prevAmounts = base2024
    budgetBase = 22000
  } else {
    currentAmounts = base2024
    prevAmounts = base2023
    budgetBase = 20000
  }

  return MONTH_NAMES.map((m, idx) => ({
    month: MONTH_FULL_NAMES[idx],
    shortMonth: m,
    monthIndex: idx,
    amount: Math.round(currentAmounts[idx] * multiplier),
    previousYearAmount: Math.round(prevAmounts[idx] * multiplier),
    budget: Math.round(budgetBase * multiplier),
  }))
}

export function getDailyDataForMonth(
  tenantId: string | number,
  year: number,
  month: number,
): Array<{
  day: number
  date: string
  label: string
  total: number
  transactions: number
}> {
  const tid = Number(tenantId)
  const multiplier = tid === 103 ? 7.86 : tid === 102 ? 1.78 : 1.0

  const daysInMonth = new Date(year, month, 0).getDate()
  const shortMonthName = MONTH_NAMES[month - 1]

  // Predetermined baseline daily weights with peaks on weekdays & mid/end-month billing
  const weights = [
    28, 35, 12, 18, 45, 52, 22,
    30, 42, 60, 25, 33, 48, 55,
    38, 40, 85, 140, 32, 45, 29,
    95, 38, 42, 160, 35, 48, 58,
    30, 42, 50,
  ]

  // Monthly totals in baseline USD
  let baseTargetMonth: number
  if (month === 10) baseTargetMonth = 18450
  else if (month === 9) baseTargetMonth = 16980
  else if (month === 8) baseTargetMonth = 17100
  else if (month === 7) baseTargetMonth = 13900
  else if (month === 6) baseTargetMonth = 15800
  else baseTargetMonth = 14200

  const totalTarget = baseTargetMonth * multiplier
  const activeWeights = weights.slice(0, daysInMonth)
  const sumWeights = activeWeights.reduce((a, b) => a + b, 0)

  let runningSum = 0
  const result: Array<{
    day: number
    date: string
    label: string
    total: number
    transactions: number
  }> = []

  for (let d = 1; d <= daysInMonth; d++) {
    const isLast = d === daysInMonth
    const padDay = d.toString().padStart(2, '0')
    const padMonth = month.toString().padStart(2, '0')
    const dateStr = `${year}-${padMonth}-${padDay}`

    let dayAmount: number
    if (isLast) {
      dayAmount = Math.max(10, Math.round(totalTarget - runningSum))
    } else {
      const raw = Math.round((activeWeights[d - 1] / sumWeights) * totalTarget)
      dayAmount = Math.max(15, raw)
      runningSum += dayAmount
    }

    // Number of transactions on this day
    const txCount = dayAmount > 800 * multiplier ? 4 : dayAmount > 400 * multiplier ? 3 : dayAmount > 150 * multiplier ? 2 : 1

    result.push({
      day: d,
      date: dateStr,
      label: `${shortMonthName} ${d}`,
      total: dayAmount,
      transactions: txCount,
    })
  }

  return result
}

