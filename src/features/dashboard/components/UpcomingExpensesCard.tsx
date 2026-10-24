import React from 'react'
import { Link } from 'react-router-dom'
import { Clock, ArrowRight, Calendar, RefreshCw } from 'lucide-react'
import type { UpcomingExpenseItem } from '../types'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency, formatDate } from '@/lib/formatters'

interface UpcomingExpensesCardProps {
  items: UpcomingExpenseItem[]
  currency: string
  locale: string
}

export const UpcomingExpensesCard: React.FC<UpcomingExpensesCardProps> = ({
  items,
  currency,
  locale,
}) => {
  return (
    <Card className="border-border/80 shadow-xs flex flex-col justify-between">
      <div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Upcoming Scheduled Expenses</span>
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              Next 30 Days
            </Badge>
          </div>
          <CardDescription>
            Recurring subscriptions and scheduled invoices due for payment.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-0 px-6">
          <div className="divide-y divide-border/50">
            {items.map((item) => (
              <div
                key={item.id}
                className="py-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {item.title}
                    </span>
                    {item.isRecurring && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.2 rounded"
                        title="Recurring subscription"
                      >
                        <RefreshCw className="w-2.5 h-2.5 text-muted-foreground" />
                        recurring
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{item.vendor}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(item.dueDate, { locale, dateStyle: 'medium' })}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="font-semibold font-mono text-foreground text-sm block">
                    {formatCurrency(item.amount, { currency, locale })}
                  </span>
                  <Badge
                    variant={item.status === 'AUTO_PAY' ? 'info' : 'outline'}
                    className="text-[10px] px-1.5 py-0"
                  >
                    {item.status === 'AUTO_PAY' ? 'Auto-Debit' : 'Scheduled'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </div>

      <div className="p-4 pt-3 border-t border-border/60 mt-3 bg-muted/20 rounded-b-xl flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          Showing {items.length} upcoming transactions
        </span>
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-xs">
          <Link to="/expenses">
            <span>Manage Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  )
}
