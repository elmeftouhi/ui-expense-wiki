import { ArrowDown, ArrowUp } from 'lucide-react'
import type { Category } from '../types'

export function CategoryReorderControls({ category, siblings, disabled, onMove }: {
  category: Category
  siblings: Category[]
  disabled: boolean
  onMove: (category: Category, level: number) => void
}) {
  const index = siblings.findIndex((sibling) => sibling.id === category.id)
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label={`Reorder ${category.name}`}>
      {([
        { direction: 'up', offset: -1, Icon: ArrowUp },
        { direction: 'down', offset: 1, Icon: ArrowDown },
      ] as const).map(({ direction, offset, Icon }) => (
        <button
          key={direction}
          type="button"
          aria-label={`Move ${category.name} ${direction}`}
          disabled={disabled || index < 0 || index + offset < 0 || index + offset >= siblings.length}
          onClick={() => onMove(category, index + offset + 1)}
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30"
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
