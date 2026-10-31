import React from 'react'
import { CategoryIcon } from '@/features/categories/components/CategoryIcon'
import { cn } from '@/lib/utils'
import type { CategoryOption } from '../utils/categoryOptions'

interface BudgetCategoryChipsProps {
  categoryIds: number[]
  categoriesById: Map<number, CategoryOption>
  /** Show at most this many chips; the rest collapse into "+N". Omit to show all. */
  max?: number
  className?: string
}

export const BudgetCategoryChips: React.FC<BudgetCategoryChipsProps> = ({
  categoryIds,
  categoriesById,
  max,
  className,
}) => {
  if (categoryIds.length === 0) {
    return <span className="text-[11px] text-muted-foreground">No categories</span>
  }
  const visible = max ? categoryIds.slice(0, max) : categoryIds
  const hidden = categoryIds.length - visible.length
  const hiddenNames = categoryIds
    .slice(visible.length)
    .map((id) => categoriesById.get(id)?.name ?? `#${id}`)
    .join(', ')

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {visible.map((id) => {
        const cat = categoriesById.get(id)
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground/85"
          >
            {cat?.icon ? (
              <span
                aria-hidden="true"
                className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-xs"
                style={{
                  color: cat.textColor || undefined,
                }}
              >
                <CategoryIcon name={cat.icon} className="h-3 w-3" />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: cat?.textColor || 'hsl(var(--muted-foreground))' }}
              />
            )}
            <span className="truncate max-w-32">{cat?.name ?? `Category #${id}`}</span>
          </span>
        )
      })}
      {hidden > 0 && (
        <span
          title={hiddenNames}
          className="rounded-md bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-muted-foreground"
        >
          +{hidden}
        </span>
      )}
    </div>
  )
}
