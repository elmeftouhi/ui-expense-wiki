import { Link } from 'react-router-dom'
import { BarChart3, ClockAlert, ReceiptText } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ExpenseViewTab = 'all' | 'overdue' | 'statistics'

export function ExpenseViewsNav({
  active,
  overdueCount,
}: {
  active: ExpenseViewTab
  overdueCount?: number
}) {
  const tabs: Array<{
    key: ExpenseViewTab
    label: string
    to: string
    icon: typeof ReceiptText
  }> = [
    { key: 'all', label: 'All expenses', to: '/expenses', icon: ReceiptText },
    { key: 'overdue', label: 'Overdue', to: '/expenses/overdue', icon: ClockAlert },
    { key: 'statistics', label: 'Statistics', to: '/expenses/statistics', icon: BarChart3 },
  ]

  return (
    <nav
      aria-label="Expense views"
      className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border/70 bg-muted/60 p-1 text-xs custom-scrollbar"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = active === tab.key
        return (
          <Link
            key={tab.key}
            to={tab.to}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'bg-background text-foreground shadow-xs font-semibold'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className={cn('h-3.5 w-3.5 shrink-0', tab.key === 'overdue' && (overdueCount ?? 0) > 0 && !isActive && 'text-destructive')} aria-hidden="true" />
            <span>{tab.label}</span>
            {tab.key === 'overdue' && overdueCount !== undefined && overdueCount > 0 && (
              <span
                className={cn(
                  'ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-mono tabular-nums font-semibold',
                  isActive
                    ? 'bg-destructive/15 text-destructive'
                    : 'bg-destructive text-destructive-foreground',
                )}
              >
                {overdueCount}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

