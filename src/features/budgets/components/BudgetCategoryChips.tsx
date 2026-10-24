import React from 'react'
import { cn } from '@/lib/utils'
import type { CategoryOption } from '../utils/categoryOptions'

interface BudgetCategoryChipsProps {
  categoryIds: number[]
  categoriesById: Map<number, CategoryOption>
  /** Show at most this many chips; the rest collapse into "+N". Omit to show all. */
  max?: number
  className?: string
}

export const BudgetCategoryChips: React.FC<BudgetCategoryChipsProps> = ({ categoryIds, categoriesById, max, className }) => {
  if (categoryIds.length === 0) {
    return <span className="text-[11px] italic text-muted-foreground">No categories</span>
  }
  const visible = max ? categoryIds.slice(0, max) : categoryIds
  const hidden = categoryIds.length - visible.length
  const hiddenNames = categoryIds
    .slice(visible.length)
    .map((id) => categoriesById.get(id)?.name ?? `#${id}`)
    .join(', ')

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visible.map((id) => {
        const cat = categoriesById.get(id)
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-foreground/80"
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: cat?.textColor || 'hsl(var(--muted-foreground))' }}
            />
            {cat?.name ?? `Category #${id}`}
          </span>
        )
      })}
      {hidden > 0 && (
        <span title={hiddenNames} className="rounded-md border border-dashed border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          +{hidden}
        </span>
      )}
    </div>
  )
}
