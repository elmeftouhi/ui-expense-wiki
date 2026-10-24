import React, { useId, useMemo, useState } from 'react'
import { Check, Loader2, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CategoryOption } from '../utils/categoryOptions'

interface CategoryMultiSelectProps {
  options: CategoryOption[]
  value: number[]
  onChange: (next: number[]) => void
  id?: string
  isLoading?: boolean
  disabled?: boolean
  invalid?: boolean
  'aria-describedby'?: string
}

/**
 * Searchable checklist for picking one or more categories. Selected items render as removable chips.
 * Inactive categories stay selectable (an existing budget may already reference them) but are flagged.
 */
export const CategoryMultiSelect: React.FC<CategoryMultiSelectProps> = ({
  options,
  value,
  onChange,
  id,
  isLoading = false,
  disabled = false,
  invalid = false,
  'aria-describedby': describedBy,
}) => {
  const generatedId = useId()
  const listId = `${id ?? generatedId}-list`
  const [query, setQuery] = useState('')
  const selected = useMemo(() => new Set(value), [value])
  const optionsById = useMemo(() => new Map(options.map((o) => [o.id, o])), [options])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter(
      (o) => o.name.toLowerCase().includes(q) || o.parentName?.toLowerCase().includes(q),
    )
  }, [options, query])

  const toggle = (optionId: number) => {
    if (disabled) return
    onChange(selected.has(optionId) ? value.filter((v) => v !== optionId) : [...value, optionId])
  }

  const selectAllVisible = () => {
    const next = new Set(value)
    filtered.forEach((o) => next.add(o.id))
    onChange(Array.from(next))
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-background transition-colors',
        invalid ? 'border-destructive/60 ring-1 ring-destructive/30' : 'border-input',
        disabled && 'opacity-60',
      )}
    >
      {/* Selected chips */}
      <div className="flex min-h-10 flex-wrap items-center gap-1.5 border-b border-border/60 px-2.5 py-2">
        {value.length === 0 ? (
          <span className="text-[11px] text-muted-foreground">No categories selected</span>
        ) : (
          value.map((cid) => {
            const opt = optionsById.get(cid)
            const label = opt?.name ?? `Category #${cid}`
            return (
              <span
                key={cid}
                className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-0.5 pl-2 pr-1 text-[11px] font-medium text-primary"
              >
                {label}
                <button
                  type="button"
                  onClick={() => toggle(cid)}
                  disabled={disabled}
                  aria-label={`Remove ${label}`}
                  className="cursor-pointer rounded-full p-0.5 hover:bg-primary/15"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })
        )}
      </div>

      {/* Search + bulk actions */}
      <div className="flex items-center gap-2 border-b border-border/60 px-2.5 py-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          id={id}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          placeholder="Search categories…"
          aria-controls={listId}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className="h-7 w-full bg-transparent text-xs focus:outline-none"
        />
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={selectAllVisible}
            disabled={disabled}
            className="shrink-0 cursor-pointer text-[11px] font-medium text-primary hover:underline"
          >
            Select {query ? 'matches' : 'all'}
          </button>
        )}
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={disabled}
            className="shrink-0 cursor-pointer text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>

      {/* Options */}
      <ul
        id={listId}
        role="listbox"
        aria-multiselectable="true"
        aria-label="Categories"
        className="custom-scrollbar max-h-48 overflow-y-auto p-1"
      >
        {isLoading ? (
          <li className="flex items-center justify-center gap-2 py-6 text-[11px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading categories…
          </li>
        ) : filtered.length === 0 ? (
          <li className="py-6 text-center text-[11px] text-muted-foreground">
            {options.length === 0 ? 'No categories exist yet. Create one on the Categories page.' : 'No categories match your search.'}
          </li>
        ) : (
          filtered.map((opt) => {
            const isSelected = selected.has(opt.id)
            return (
              <li
                key={opt.id}
                role="option"
                aria-selected={isSelected}
                tabIndex={disabled ? -1 : 0}
                onClick={() => toggle(opt.id)}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault()
                    toggle(opt.id)
                  }
                  if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
                    e.preventDefault()
                    const options = e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="option"]')
                    if (!options?.length) return
                    const index = Array.from(options).indexOf(e.currentTarget)
                    const next = e.key === 'Home' ? 0 : e.key === 'End' ? options.length - 1 :
                      (index + (e.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length
                    options[next].focus()
                  }
                }}
                style={{ paddingLeft: `${0.5 + opt.depth * 1.1}rem` }}
                className={cn(
                  'flex cursor-pointer select-none items-center gap-2 rounded-lg py-1.5 pr-2 text-xs transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  isSelected ? 'bg-primary/[0.07] text-foreground' : 'text-foreground/90 hover:bg-muted/70',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background',
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: opt.textColor || 'hsl(var(--muted-foreground))' }}
                />
                <span className={cn('truncate', opt.depth > 0 && 'text-foreground/80')}>{opt.name}</span>
                {!opt.active && (
                  <span className="ml-auto rounded border border-border px-1 text-[9px] uppercase text-muted-foreground">
                    inactive
                  </span>
                )}
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
