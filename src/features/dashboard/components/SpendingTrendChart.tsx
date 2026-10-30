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
import { useDailyExpenseChart, useMonthlyExpenseChart } from '../hooks/useExpenseCharts'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/lib/api-error'

interface SpendingTrendChartProps {
  tenantId: string | number
  currency: string
  locale: string
}

type ChartViewTab = 'daily' | 'monthly'

export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({
  tenantId,
  currency,
  locale,
}) => {
  const [activeTab, setActiveTab] = useState<ChartViewTab>('daily')
  const [today] = useState(() => new Date())
  const availableYears = Array.from({ length: 3 }, (_, idx) => today.getFullYear() - idx)
  const availableMonths = Array.from({ length: today.getMonth() + 25 }, (_, idx) => {
    const date = new Date(today.getFullYear(), today.getMonth() - idx, 1)
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      label: date.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
    }
  })
  const [selectedYear, setSelectedYear] = useState(today.getFullYear())
  const [selectedMonthIdx, setSelectedMonthIdx] = useState(0)
  const activeMonthOption = availableMonths[selectedMonthIdx]
  const monthlyQuery = useMonthlyExpenseChart(tenantId, selectedYear, activeTab === 'monthly')
  const dailyQuery = useDailyExpenseChart(
    tenantId, activeMonthOption.year, activeMonthOption.month, activeTab === 'daily',
  )
  const activeQuery = activeTab === 'daily' ? dailyQuery : monthlyQuery

  const monthlyData = useMemo(() => {
    if (!monthlyQuery.data) return []
    const response = monthlyQuery.data
    return [...response.totals].sort((a, b) => a.month - b.month).map((point) => {
      const date = new Date(response.year, point.month - 1, 1)
      return {
        month: date.toLocaleDateString(locale, { month: 'long' }),
        shortMonth: date.toLocaleDateString(locale, { month: 'short' }),
        amount: point.total,
        previousYearAmount: response.previousYearTotals.find((prev) => prev.month === point.month)?.total ?? 0,
      }
    })
  }, [monthlyQuery.data, locale])

  const dailyHasData = !!dailyQuery.data
    && (dailyQuery.data.totals.length > 0 || dailyQuery.data.previousMonthTotals.length > 0)

  // One point per day of the selected month; previous month is aligned by day number.
  const dailyData = useMemo(() => {
    if (!dailyQuery.data || !dailyHasData) return []
    const { year, month, totals, previousMonthTotals } = dailyQuery.data
    const daysInMonth = new Date(year, month, 0).getDate()
    const sumByDay = (points: { day: number; total: number }[]) => {
      const map = new Map<number, number>()
      for (const p of points) map.set(p.day, (map.get(p.day) ?? 0) + p.total)
      return map
    }
    const current = sumByDay(totals)
    const previous = sumByDay(previousMonthTotals)
    return Array.from({ length: daysInMonth }, (_, idx) => {
      const day = idx + 1
      return {
        day,
        total: current.get(day) ?? 0,
        previousTotal: previous.get(day) ?? 0,
        label: new Date(year, month - 1, day)
          .toLocaleDateString(locale, { month: 'short', day: 'numeric' }),
      }
    })
  }, [dailyQuery.data, dailyHasData, locale])

  // Summary statistics for Daily Tab (based on days reported by the API for the current month)
  const dailyStats = useMemo(() => {
    const reportedDays = new Set(dailyQuery.data?.totals.map((p) => p.day) ?? [])
    const points = dailyData.filter((d) => reportedDays.has(d.day))
    const total = points.reduce((acc, d) => acc + d.total, 0)
    const avg = points.length > 0 ? total / points.length : 0
    let peak = points[0]
    for (const d of points) {
      if (!peak || d.total > peak.total) peak = d
    }
    return { total, avg, peak }
  }, [dailyData, dailyQuery.data])

  const previousMonthLabel = useMemo(() => {
    const date = new Date(activeMonthOption.year, activeMonthOption.month - 2, 1)
    return date.toLocaleDateString(locale, { month: 'short', year: 'numeric' })
  }, [activeMonthOption.year, activeMonthOption.month, locale])

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
  const canGoPrevMonth = selectedMonthIdx < availableMonths.length - 1
  const canGoNextMonth = selectedMonthIdx > 0

  const handlePrevMonth = () => {
    if (canGoPrevMonth) setSelectedMonthIdx((prev) => prev + 1)
  }

  const handleNextMonth = () => {
    if (canGoNextMonth) setSelectedMonthIdx((prev) => prev - 1)
  }

  // Navigation handlers for Monthly Year
  const currentYearIdx = availableYears.indexOf(selectedYear)
  const canGoPrevYear = currentYearIdx < availableYears.length - 1
  const canGoNextYear = currentYearIdx > 0

  const handlePrevYear = () => {
    if (canGoPrevYear) setSelectedYear(availableYears[currentYearIdx + 1])
  }

  const handleNextYear = () => {
    if (canGoNextYear) setSelectedYear(availableYears[currentYearIdx - 1])
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
                ? `Daily spending for ${activeMonthOption.label} compared with the previous month.`
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
              <span>Daily</span>
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
                aria-label="Chart month"
                value={selectedMonthIdx}
                onChange={(e) => setSelectedMonthIdx(Number(e.target.value))}
                className="h-7 px-2.5 text-xs font-medium rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                {availableMonths.map((opt, idx) => (
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
                aria-label="Chart year"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="h-7 px-2.5 text-xs font-mono font-medium rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
              >
                {availableYears.map((y) => (
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
          {activeQuery.isSuccess && (activeTab === 'daily' ? dailyData.length : monthlyData.length) > 0 && <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground font-mono">
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
          </div>}
        </div>
      </CardHeader>

      <CardContent className="pt-1">
        {activeQuery.isPending ? (
          <p role="status" className="py-12 text-sm text-muted-foreground">Loading spending chart...</p>
        ) : activeQuery.isError ? (
          <div role="alert" className="space-y-2 py-12 text-sm">
            <p className="text-destructive">{getApiErrorMessage(activeQuery.error, 'Could not load spending chart.')}</p>
            <Button variant="outline" size="sm" onClick={() => void activeQuery.refetch()}>Retry chart</Button>
          </div>
        ) : (activeTab === 'daily' ? dailyData.length : monthlyData.length) === 0 ? (
          <p className="py-12 text-sm text-muted-foreground">No spending data for this period.</p>
        ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'daily' ? (
              /* DAILY CHART: current month vs previous month bars */
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
                      label: string
                      total: number
                      previousTotal: number
                    }

                    return (
                      <div className="rounded-xl border border-border/80 bg-card text-card-foreground p-3 shadow-xl text-xs space-y-1.5 min-w-[190px]">
                        <div className="flex items-center justify-between border-b border-border/60 pb-1">
                          <span className="font-semibold text-foreground">
                            {item.label}, {activeMonthOption.year}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#2563eb]" />
                            <span className="text-muted-foreground">Current Month:</span>
                          </div>
                          <span className="font-mono font-bold text-foreground">
                            {formatCurrency(item.total, { currency, locale })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#94a3b8]" />
                            <span className="text-muted-foreground">
                              Previous Month (day {item.day}, {previousMonthLabel}):
                            </span>
                          </div>
                          <span className="font-mono text-muted-foreground">
                            {formatCurrency(item.previousTotal, { currency, locale })}
                          </span>
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
                  dataKey="total"
                  name="Current Month"
                  fill="#2563eb"
                  radius={[3, 3, 0, 0]}
                />
                <Bar
                  dataKey="previousTotal"
                  name="Previous Month"
                  fill="#94a3b8"
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
                    }

                    const diff = point.amount - point.previousYearAmount
                    const isUp = diff >= 0
                    const percent =
                      point.previousYearAmount > 0
                        ? ((diff / point.previousYearAmount) * 100).toFixed(1)
                        : null

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
                            <span>{percent === null ? 'YoY N/A' : `${isUp ? '+' : ''}${percent}% YoY`}</span>
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
        )}
      </CardContent>
    </Card>
  )
}
