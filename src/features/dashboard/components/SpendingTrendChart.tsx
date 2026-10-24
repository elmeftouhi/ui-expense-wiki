import React, { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts'
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  BarChart3,
  TrendingUp,
  Receipt,
} from 'lucide-react'
import type { MonthlyTrendPoint } from '../types'
import {
  AVAILABLE_YEARS,
  AVAILABLE_MONTHS,
  getMonthlyDataForYear,
  getDailyDataForMonth,
} from '../data/mockDashboardData'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

interface SpendingTrendChartProps {
  tenantId?: string | number
  data?: MonthlyTrendPoint[]
  currency: string
  locale: string
}

type ChartViewTab = 'daily' | 'monthly'

export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({
  tenantId = 101,
  currency,
  locale,
}) => {
  const [activeTab, setActiveTab] = useState<ChartViewTab>('daily')
  const [selectedYear, setSelectedYear] = useState<number>(2026)
  const [selectedMonthIdx, setSelectedMonthIdx] = useState<number>(0) // index in AVAILABLE_MONTHS (0 = Oct 2026)

  const activeMonthOption = AVAILABLE_MONTHS[selectedMonthIdx] ?? AVAILABLE_MONTHS[0]

  // Monthly Data for the selected year
  const monthlyData = useMemo(() => {
    return getMonthlyDataForYear(tenantId, selectedYear)
  }, [tenantId, selectedYear])

  // Daily Data for the selected month
  const dailyData = useMemo(() => {
    return getDailyDataForMonth(tenantId, activeMonthOption.year, activeMonthOption.month)
  }, [tenantId, activeMonthOption])

  // Summary statistics for Daily Tab
  const dailyStats = useMemo(() => {
    const total = dailyData.reduce((acc, d) => acc + d.total, 0)
    const count = dailyData.length
    const avg = count > 0 ? total / count : 0
    let peak = dailyData[0]
    for (const d of dailyData) {
      if (!peak || d.total > peak.total) peak = d
    }
    return { total, avg, peak }
  }, [dailyData])

  // Summary statistics for Monthly Tab
  const monthlyStats = useMemo(() => {
    const total = monthlyData.reduce((acc, m) => acc + m.amount, 0)
    const count = monthlyData.length
    const avg = count > 0 ? total / count : 0
    let peak = monthlyData[0]
    for (const m of monthlyData) {
      if (!peak || m.amount > peak.amount) peak = m
    }
    return { total, avg, peak }
  }, [monthlyData])

  // Navigation handlers for Daily Month
  const canGoPrevMonth = selectedMonthIdx < AVAILABLE_MONTHS.length - 1
  const canGoNextMonth = selectedMonthIdx > 0

  const handlePrevMonth = () => {
    if (canGoPrevMonth) setSelectedMonthIdx((prev) => prev + 1)
  }

  const handleNextMonth = () => {
    if (canGoNextMonth) setSelectedMonthIdx((prev) => prev - 1)
  }

  // Navigation handlers for Monthly Year
  const currentYearIdx = AVAILABLE_YEARS.indexOf(selectedYear)
  const canGoPrevYear = currentYearIdx < AVAILABLE_YEARS.length - 1
  const canGoNextYear = currentYearIdx > 0

  const handlePrevYear = () => {
    if (canGoPrevYear) setSelectedYear(AVAILABLE_YEARS[currentYearIdx + 1])
  }

  const handleNextYear = () => {
    if (canGoNextYear) setSelectedYear(AVAILABLE_YEARS[currentYearIdx - 1])
  }

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="pb-3 space-y-3">
        {/* Row 1: Header Title & View Granularity Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">
                Expenditure Trends & Analytics
              </CardTitle>
              <Badge variant="outline" className="text-[11px] font-mono">
                {activeTab === 'daily' ? activeMonthOption.label : `Fiscal ${selectedYear}`}
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {activeTab === 'daily'
                ? `Daily spending breakdown for ${activeMonthOption.label}.`
                : `Monthly expenditure totals and previous-year comparisons for ${selectedYear}.`}
            </CardDescription>
          </div>

          {/* Granularity Tabs (Daily vs Monthly) */}
          <div className="flex items-center p-1 rounded-xl bg-muted/60 border border-border/60 text-xs shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab('daily')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'daily'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Daily (Current Month)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('monthly')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap',
                activeTab === 'monthly'
                  ? 'bg-background text-foreground shadow-xs font-semibold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Monthly Totals</span>
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Controls (Year/Month Select & Next/Previous navigation) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border/40 text-xs">
          {activeTab === 'daily' ? (
            /* Daily View Controls: Month Selector and Next/Previous buttons */
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium flex items-center gap-1 text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Month:</span>
              </span>

              {/* Prev Month Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevMonth}
                disabled={!canGoPrevMonth}
                className="h-7 w-7 p-0 cursor-pointer"
                title="Previous month"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>

              {/* Month Dropdown Select */}
              <select
                value={selectedMonthIdx}
                onChange={(e) => setSelectedMonthIdx(Number(e.target.value))}
                className="h-7 px-2.5 text-xs font-medium rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                {AVAILABLE_MONTHS.map((opt, idx) => (
                  <option key={`${opt.year}-${opt.month}`} value={idx}>
                    {opt.label}
                  </option>
                ))}
              </select>

              {/* Next Month Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextMonth}
                disabled={!canGoNextMonth}
                className="h-7 w-7 p-0 cursor-pointer"
                title="Next month"
                aria-label="Next month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            /* Monthly View Controls: Year Selector and Next/Previous buttons */
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-medium flex items-center gap-1 text-[11px]">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Year:</span>
              </span>

              {/* Prev Year Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevYear}
                disabled={!canGoPrevYear}
                className="h-7 w-7 p-0 cursor-pointer"
                title="Previous year"
                aria-label="Previous year"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>

              {/* Year Dropdown Select */}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-7 px-2.5 text-xs font-mono font-medium rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                {AVAILABLE_YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>

              {/* Next Year Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextYear}
                disabled={!canGoNextYear}
                className="h-7 w-7 p-0 cursor-pointer"
                title="Next year"
                aria-label="Next year"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {/* Quick Metrics Summary Strip */}
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono">
            {activeTab === 'daily' ? (
              <>
                <div>
                  <span className="text-muted-foreground">Total: </span>
                  <strong className="text-foreground">
                    {formatCurrency(dailyStats.total, { currency, locale })}
                  </strong>
                </div>
                <span>•</span>
                <div>
                  <span className="text-muted-foreground">Daily Avg: </span>
                  <span className="text-foreground font-medium">
                    {formatCurrency(dailyStats.avg, { currency, locale })}
                  </span>
                </div>
                <span>•</span>
                <div className="hidden sm:inline-block">
                  <span className="text-muted-foreground">Peak: </span>
                  <span className="text-foreground font-medium">
                    {dailyStats.peak?.label} ({formatCurrency(dailyStats.peak?.total ?? 0, { currency, locale })})
                  </span>
                </div>
              </>
            ) : (
              <>
                <div>
                  <span className="text-muted-foreground">Annual Total: </span>
                  <strong className="text-foreground">
                    {formatCurrency(monthlyStats.total, { currency, locale })}
                  </strong>
                </div>
                <span>•</span>
                <div>
                  <span className="text-muted-foreground">Monthly Avg: </span>
                  <span className="text-foreground font-medium">
                    {formatCurrency(monthlyStats.avg, { currency, locale })}
                  </span>
                </div>
                <span>•</span>
                <div className="hidden sm:inline-block">
                  <span className="text-muted-foreground">Peak: </span>
                  <span className="text-foreground font-medium">
                    {monthlyStats.peak?.shortMonth} ({formatCurrency(monthlyStats.peak?.amount ?? 0, { currency, locale })})
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-1">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'daily' ? (
              /* DAILY BAR CHART */
              <BarChart
                data={dailyData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/40"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
                  className="text-xs text-muted-foreground fill-muted-foreground font-mono"
                  tickLine={false}
                  axisLine={false}
                  interval={2} // shows 1, 4, 7, 10, 13, 16... for clean spacing
                  tickFormatter={(val) => `${val}`}
                />
                <YAxis
                  className="text-xs text-muted-foreground fill-muted-foreground font-mono"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) =>
                    new Intl.NumberFormat(locale, {
                      notation: 'compact',
                      compactDisplay: 'short',
                    }).format(val)
                  }
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const item = payload[0].payload as {
                      day: number
                      date: string
                      label: string
                      total: number
                      transactions: number
                    }

                    return (
                      <div className="rounded-xl border border-border/80 bg-card text-card-foreground p-3 shadow-xl text-xs space-y-1.5 min-w-[170px]">
                        <div className="flex items-center justify-between border-b border-border/60 pb-1">
                          <span className="font-semibold text-foreground">
                            {item.label}, {activeMonthOption.year}
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            {item.transactions} {item.transactions === 1 ? 'tx' : 'txs'}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-muted-foreground">Daily Spend:</span>
                          <span className="font-mono font-bold text-foreground">
                            {formatCurrency(item.total, { currency, locale })}
                          </span>
                        </div>
                      </div>
                    )
                  }}
                />
                <Bar
                  dataKey="total"
                  name="Daily Spend"
                  fill="#2563eb"
                  radius={[3, 3, 0, 0]}
                />
              </BarChart>
            ) : (
              /* MONTHLY TOTALS BAR CHART */
              <BarChart
                data={monthlyData}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-border/40"
                  vertical={false}
                />
                <XAxis
                  dataKey="shortMonth"
                  className="text-xs text-muted-foreground fill-muted-foreground"
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  className="text-xs text-muted-foreground fill-muted-foreground font-mono"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) =>
                    new Intl.NumberFormat(locale, {
                      notation: 'compact',
                      compactDisplay: 'short',
                    }).format(val)
                  }
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null
                    const point = payload[0].payload as {
                      month: string
                      shortMonth: string
                      amount: number
                      previousYearAmount: number
                      budget: number
                    }

                    const diff = point.amount - point.previousYearAmount
                    const isUp = diff >= 0
                    const percent =
                      point.previousYearAmount > 0
                        ? ((diff / point.previousYearAmount) * 100).toFixed(1)
                        : '0.0'

                    return (
                      <div className="rounded-xl border border-border/80 bg-card text-card-foreground p-3 shadow-xl text-xs space-y-2 min-w-[200px]">
                        <div className="flex items-center justify-between border-b border-border/60 pb-1">
                          <span className="font-semibold text-foreground">
                            {point.month} {selectedYear}
                          </span>
                          <span
                            className={cn(
                              'text-[10px] font-semibold flex items-center gap-0.5',
                              isUp
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-emerald-600 dark:text-emerald-400',
                            )}
                          >
                            <TrendingUp className="w-3 h-3" />
                            <span>{isUp ? '+' : ''}{percent}% YoY</span>
                          </span>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                              <span className="text-muted-foreground">
                                {selectedYear} Spend:
                              </span>
                            </div>
                            <span className="font-mono font-bold text-foreground">
                              {formatCurrency(point.amount, { currency, locale })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]" />
                              <span className="text-muted-foreground">
                                {selectedYear - 1} Spend:
                              </span>
                            </div>
                            <span className="font-mono text-muted-foreground">
                              {formatCurrency(point.previousYearAmount, { currency, locale })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-border/40">
                            <span className="text-muted-foreground text-[11px]">
                              Monthly Budget:
                            </span>
                            <span className="font-mono text-muted-foreground text-[11px]">
                              {formatCurrency(point.budget, { currency, locale })}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  }}
                />
                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{ paddingBottom: '12px', fontSize: '11px' }}
                />
                <Bar
                  dataKey="amount"
                  name={`${selectedYear} Spend`}
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="previousYearAmount"
                  name={`${selectedYear - 1} Spend`}
                  fill="#94a3b8"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
