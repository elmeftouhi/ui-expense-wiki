import { GripVertical } from 'lucide-react'
import type { HTMLAttributes } from 'react'

export function CategoryDragHandle({ name, disabled, ...props }: HTMLAttributes<HTMLButtonElement> & {
  name: string
  disabled: boolean
}) {
  return (
    <button
      {...props}
      type="button"
      aria-label={`Drag to reorder ${name}`}
      title="Drag above or below a category in the same group"
      disabled={disabled}
      className="shrink-0 rounded p-1.5 text-muted-foreground cursor-grab active:cursor-grabbing hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-30"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )
}
