import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Check, ChevronDown, ChevronRight, Loader2, Search } from 'lucide-react'
import type { CategoryOption } from '@/features/budgets/utils/categoryOptions'
import { cn } from '@/lib/utils'
import { CategoryIcon } from './CategoryIcon'

const CLEAR_KEY = -1

interface TreeNode {
  option: CategoryOption
  parentId?: number
  childIds: number[]
}

export interface CategoryTreeSelectProps {
  options: CategoryOption[]
  value?: number | null
  onChange: (id: number | undefined) => void
  id?: string
  /** Accessible name when the trigger is not associated with a visible label. */
  label?: string
  placeholder?: string
  /** When set, the tree starts with an option that clears the selection (useful for filters). */
  clearLabel?: string
  /** Shown when the selected id is not among the options (e.g. a category that is no longer listed). */
  fallbackLabel?: string
  disabled?: boolean
  isLoading?: boolean
  invalid?: boolean
  size?: 'sm' | 'md'
  autoFocus?: boolean
  className?: string
  triggerRef?: (element: HTMLButtonElement | null) => void
  onBlur?: () => void
  'aria-describedby'?: string
}

/** Builds parent/child links from the ordered, depth-annotated option list. */
function buildTree(options: CategoryOption[]) {
  const nodes = new Map<number, TreeNode>()
  const stack: number[] = []
  for (const option of options) {
    stack.length = Math.min(stack.length, option.depth)
    const parentId = option.depth > 0 ? stack[option.depth - 1] : undefined
    nodes.set(option.id, { option, parentId, childIds: [] })
    if (parentId !== undefined) nodes.get(parentId)?.childIds.push(option.id)
    stack[option.depth] = option.id
  }
  return nodes
}

function ancestorsOf(nodes: Map<number, TreeNode>, id: number) {
  const ancestors: number[] = []
  let current = nodes.get(id)?.parentId
  while (current !== undefined && !ancestors.includes(current)) {
    ancestors.push(current)
    current = nodes.get(current)?.parentId
  }
  return ancestors
}

export function CategoryTreeSelect({
  options,
  value,
  onChange,
  id,
  label,
  placeholder = 'Choose a category',
  clearLabel,
  fallbackLabel,
  disabled = false,
  isLoading = false,
  invalid = false,
  size = 'md',
  autoFocus = false,
  className,
  triggerRef,
  onBlur,
  'aria-describedby': describedBy,
}: CategoryTreeSelectProps) {
  const generatedId = useId()
  const baseId = id ?? generatedId
  const treeId = `${baseId}-tree`
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerElement = useRef<HTMLButtonElement | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const itemRefs = useRef(new Map<number, HTMLLIElement>())
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set())
  const [activeKey, setActiveKey] = useState<number | null>(null)

  const nodes = useMemo(() => buildTree(options), [options])
  const selectedId = value || undefined
  const selected = selectedId !== undefined ? nodes.get(selectedId)?.option : undefined
  const selectedParent = selected && selectedId !== undefined ? nodes.get(nodes.get(selectedId)?.parentId ?? -1)?.option : undefined
  const search = query.trim().toLocaleLowerCase()

  const visible = useMemo(() => {
    if (search) {
      const included = new Set<number>()
      for (const option of options) {
        if (`${option.name} ${option.parentName ?? ''}`.toLocaleLowerCase().includes(search)) {
          included.add(option.id)
          ancestorsOf(nodes, option.id).forEach((ancestor) => included.add(ancestor))
        }
      }
      return options.filter((option) => included.has(option.id))
    }
    return options.filter((option) => ancestorsOf(nodes, option.id).every((ancestor) => expanded.has(ancestor)))
  }, [expanded, nodes, options, search])

  const keys = useMemo(() => [...(clearLabel && !search ? [CLEAR_KEY] : []), ...visible.map((option) => option.id)], [clearLabel, search, visible])
  const focusKey = activeKey !== null && keys.includes(activeKey) ? activeKey : keys[0]

  const isExpanded = (categoryId: number) => Boolean(search) || expanded.has(categoryId)
  const toggle = (categoryId: number, next = !expanded.has(categoryId)) => {
    setExpanded((current) => {
      const updated = new Set(current)
      if (next) updated.add(categoryId)
      else updated.delete(categoryId)
      return updated
    })
  }

  const openPanel = () => {
    if (disabled || isLoading) return
    if (selectedId !== undefined) {
      setExpanded((current) => new Set([...current, ...ancestorsOf(nodes, selectedId)]))
    }
    setActiveKey(selectedId ?? (clearLabel ? CLEAR_KEY : null))
    setQuery('')
    setOpen(true)
  }

  const close = (restoreFocus: boolean) => {
    setOpen(false)
    setQuery('')
    if (restoreFocus) triggerElement.current?.focus()
  }

  const choose = (categoryId: number | undefined) => {
    close(true)
    onChange(categoryId)
  }

  const focusItem = (key: number | undefined) => {
    if (key === undefined) return
    setActiveKey(key)
    itemRefs.current.get(key)?.focus()
  }

  const onItemKeyDown = (event: KeyboardEvent<HTMLLIElement>, key: number) => {
    const index = keys.indexOf(key)
    const node = nodes.get(key)
    const hasChildren = Boolean(node?.childIds.length)
    switch (event.key) {
      case 'ArrowDown':
        focusItem(keys[Math.min(index + 1, keys.length - 1)])
        break
      case 'ArrowUp':
        if (index === 0) searchRef.current?.focus()
        else focusItem(keys[index - 1])
        break
      case 'Home':
        focusItem(keys[0])
        break
      case 'End':
        focusItem(keys[keys.length - 1])
        break
      case 'ArrowRight':
        if (!hasChildren || !node) break
        if (!isExpanded(key)) toggle(key, true)
        else focusItem(node.childIds.find((childId) => keys.includes(childId)))
        break
      case 'ArrowLeft':
        if (hasChildren && isExpanded(key) && !search) toggle(key, false)
        else focusItem(node?.parentId)
        break
      case 'Enter':
      case ' ':
        choose(key === CLEAR_KEY ? undefined : key)
        break
      default:
        return
    }
    event.preventDefault()
  }

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      focusItem(focusKey)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const firstMatch = visible.find((option) => option.name.toLocaleLowerCase().includes(search))
      if (search && firstMatch) choose(firstMatch.id)
    }
  }

  const triggerText = isLoading
    ? 'Loading categories…'
    : selected?.name ?? (selectedId !== undefined ? fallbackLabel ?? `Category #${selectedId}` : clearLabel ?? placeholder)

  return (
    <div
      ref={containerRef}
      className={cn('relative min-w-0', className)}
      onBlur={(event) => {
        if (containerRef.current?.contains(event.relatedTarget as Node | null)) return
        if (open) close(false)
        onBlur?.()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          event.stopPropagation()
          close(true)
        }
      }}
    >
      <button
        ref={(element) => {
          triggerElement.current = element
          triggerRef?.(element)
        }}
        id={id}
        type="button"
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="tree"
        aria-expanded={open}
        aria-controls={open ? treeId : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? close(true) : openPanel())}
        onKeyDown={(event) => {
          if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
            event.preventDefault()
            openPanel()
          }
        }}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-input bg-background px-2.5 text-left transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
          size === 'sm' ? 'h-9 text-xs' : 'h-10 text-sm',
          invalid && 'border-destructive/60 focus-visible:ring-destructive/40',
          open && 'border-ring',
        )}
      >
        {isLoading ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none" />
        ) : selected ? (
          <CategorySwatch option={selected} small />
        ) : null}
        <span className="min-w-0 flex-1 truncate">
          <span className={cn(!selected && 'text-muted-foreground')}>{triggerText}</span>
          {selectedParent && <span className="text-muted-foreground"> in {selectedParent.name}</span>}
        </span>
        <ChevronDown aria-hidden="true" className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          tabIndex={-1}
          className="absolute left-0 top-full z-50 mt-1.5 w-full min-w-[17rem] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg focus:outline-none"
        >
          <div className="flex items-center gap-2 border-b border-border/70 px-3 py-2">
            <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={searchRef}
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              aria-label="Search categories"
              aria-controls={treeId}
              placeholder="Search categories…"
              className="h-7 w-full bg-transparent text-sm focus:outline-none"
            />
          </div>
          <ul id={treeId} role="tree" aria-label={label ?? 'Categories'} className="custom-scrollbar max-h-72 overflow-y-auto p-1.5">
            {keys.includes(CLEAR_KEY) && (
              <li
                ref={(element) => { if (element) itemRefs.current.set(CLEAR_KEY, element); else itemRefs.current.delete(CLEAR_KEY) }}
                role="treeitem"
                aria-level={1}
                aria-selected={selectedId === undefined}
                tabIndex={focusKey === CLEAR_KEY ? 0 : -1}
                onFocus={() => setActiveKey(CLEAR_KEY)}
                onClick={() => choose(undefined)}
                onKeyDown={(event) => onItemKeyDown(event, CLEAR_KEY)}
                className={rowClass(selectedId === undefined)}
              >
                <span className="w-5 shrink-0" aria-hidden="true" />
                <span className="flex-1 truncate font-medium">{clearLabel}</span>
                {selectedId === undefined && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />}
              </li>
            )}
            {visible.map((option) => {
              const node = nodes.get(option.id)
              const childCount = node?.childIds.length ?? 0
              const isSelected = option.id === selectedId
              const branchOpen = childCount > 0 && isExpanded(option.id)
              return (
                <li
                  key={option.id}
                  ref={(element) => { if (element) itemRefs.current.set(option.id, element); else itemRefs.current.delete(option.id) }}
                  role="treeitem"
                  aria-label={`${option.name}${option.active ? '' : ' (inactive)'}`}
                  aria-level={option.depth + 1}
                  aria-selected={isSelected}
                  aria-expanded={childCount > 0 ? branchOpen : undefined}
                  tabIndex={focusKey === option.id ? 0 : -1}
                  onFocus={() => setActiveKey(option.id)}
                  onClick={() => choose(option.id)}
                  onKeyDown={(event) => onItemKeyDown(event, option.id)}
                  className={rowClass(isSelected)}
                >
                  {Array.from({ length: option.depth }, (_, level) => (
                    <span key={level} aria-hidden="true" className="ml-2.5 mr-0.5 h-8 w-px shrink-0 self-stretch bg-border" />
                  ))}
                  {childCount > 0 ? (
                    <span
                      aria-hidden="true"
                      title={branchOpen ? 'Collapse' : 'Expand'}
                      onClick={(event) => {
                        event.stopPropagation()
                        if (!search) toggle(option.id)
                      }}
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                    >
                      <ChevronRight className={cn('h-3.5 w-3.5 transition-transform motion-reduce:transition-none', branchOpen && 'rotate-90')} />
                    </span>
                  ) : (
                    <span className="w-5 shrink-0" aria-hidden="true" />
                  )}
                  <CategorySwatch option={option} />
                  <span className={cn('min-w-0 flex-1 truncate', option.depth === 0 ? 'font-medium' : 'text-foreground/85', !option.active && 'text-muted-foreground')}>
                    {option.name}
                    {!option.active && <span className="ml-1.5 text-xs font-normal">(inactive)</span>}
                  </span>
                  {childCount > 0 && !branchOpen && (
                    <span aria-hidden="true" className="shrink-0 rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{childCount}</span>
                  )}
                  {isSelected && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-primary" />}
                </li>
              )
            })}
            {visible.length === 0 && (
              <li role="none" className="px-3 py-6 text-center text-xs text-muted-foreground">
                <span role="status">{search ? 'No matching categories. Try another name.' : 'No categories yet. Create one on the Categories page.'}</span>
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

function rowClass(selected: boolean) {
  return cn(
    'flex min-h-9 cursor-pointer select-none items-center gap-1.5 rounded-lg pr-2 pl-1 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
    selected ? 'bg-primary/10 text-foreground' : 'hover:bg-muted focus:bg-muted',
  )
}

function CategorySwatch({ option, small = false }: { option: CategoryOption; small?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn('flex shrink-0 items-center justify-center rounded-md', small ? 'h-5 w-5' : 'h-6 w-6', !option.backgroundColor && 'bg-muted')}
      style={{ backgroundColor: option.backgroundColor || undefined, color: option.textColor || undefined }}
    >
      <CategoryIcon name={option.icon} className={small ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
    </span>
  )
}
