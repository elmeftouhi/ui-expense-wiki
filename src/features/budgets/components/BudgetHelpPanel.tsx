import React from 'react'
import { ChevronDown, Info, Layers, RefreshCw, Sparkles, Timer, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

const RULES: { icon: React.ComponentType<{ className?: string }>; title: string; body: string }[] = [
  {
    icon: Zap,
    title: 'Automatic deductions',
    body: 'You never log spend against a budget manually. When an expense is saved, the backend deducts it from every matching budget.',
  },
  {
    icon: Layers,
    title: 'Categories can be shared',
    body: 'One category can belong to multiple budgets. An expense in that category counts toward each of them.',
  },
  {
    icon: Timer,
    title: 'Periods are created lazily',
    body: 'A period (e.g. "October 2026") is created only when the first matching expense for that period arrives. Until then the budget shows "No activity yet".',
  },
  {
    icon: RefreshCw,
    title: 'Edits recalculate spend',
    body: 'Updating or deleting an expense recalculates spend on the affected budget periods.',
  },
  {
    icon: Sparkles,
    title: 'Backdated expenses',
    body: 'Older expenses are linked only if the matching period instance already exists. Adding a category to a budget does not create past periods.',
  },
]

interface BudgetHelpPanelProps {
  defaultOpen?: boolean
  className?: string
}

/** Collapsible "How budget tracking works" explainer reflecting backend business rules. */
export const BudgetHelpPanel: React.FC<BudgetHelpPanelProps> = ({ defaultOpen = false, className }) => (
  <details
    open={defaultOpen}
    className={cn(
      'group rounded-xl border border-primary/15 bg-gradient-to-br from-primary/[0.06] via-card to-card shadow-xs',
      className,
    )}
  >
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs font-semibold text-foreground [&::-webkit-details-marker]:hidden">
      <span className="flex items-center gap-2">
        <Info className="h-4 w-4 text-primary" />
        How budget tracking works
      </span>
      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
    </summary>
    <ul className="grid gap-3 px-4 pb-4 sm:grid-cols-2 lg:grid-cols-5">
      {RULES.map(({ icon: Icon, title, body }) => (
        <li key={title} className="rounded-lg border border-border/60 bg-background/60 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
            <Icon className="h-3.5 w-3.5 text-primary" />
            {title}
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">{body}</p>
        </li>
      ))}
    </ul>
  </details>
)
