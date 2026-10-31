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
      title="Drag to reorder"
      disabled={disabled}
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/75 cursor-grab active:cursor-grabbing transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-25"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )
}
