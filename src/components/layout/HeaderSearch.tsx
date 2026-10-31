import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Clock, X, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'expense_wiki_search_history'

function readStoredHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return []
    const parsed: unknown = JSON.parse(saved)
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).slice(0, 6)
    }
  } catch {
    // ignore storage errors
  }
  return []
}

function detectMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent)
}

export const HeaderSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<string[]>(readStoredHistory)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const isMac = detectMacPlatform()

  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        const activeModal = document.querySelector('[role="dialog"][aria-modal="true"]')
        if (activeModal && !containerRef.current?.contains(activeModal)) {
          return
        }
        event.preventDefault()
        setIsOpen((prev) => !prev)
        return
      }

      if (event.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      const id = window.setTimeout(() => inputRef.current?.focus(), 20)
      return () => window.clearTimeout(id)
    }
  }, [isOpen])

  const saveHistory = (items: string[]) => {
    setHistory(items)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore storage errors
    }
  }

  const handleSearch = (searchTerm: string) => {
    const trimmed = searchTerm.trim()
    if (!trimmed) return

    const updated = [
      trimmed,
      ...history.filter((item) => item.toLowerCase() !== trimmed.toLowerCase()),
    ].slice(0, 6)
    saveHistory(updated)
    setIsOpen(false)
    setQuery('')

    navigate(`/expenses?search=${encodeURIComponent(trimmed)}`)
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch(query)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsOpen(false)
    }
  }

  const removeHistoryItem = (e: React.MouseEvent, itemToRemove: string) => {
    e.stopPropagation()
    saveHistory(history.filter((item) => item !== itemToRemove))
  }

  const clearAllHistory = () => {
    saveHistory([])
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        id="header-search-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'flex h-9 w-9 sm:w-48 lg:w-60 items-center justify-center sm:justify-between gap-2 rounded-lg border border-border/70 bg-muted/35 sm:px-2.5 text-muted-foreground hover:bg-accent/60 hover:text-foreground transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring',
          isOpen && 'bg-accent/70 text-foreground ring-2 ring-ring/30',
        )}
        title={`Search expenses (${isMac ? '⌘K' : 'Ctrl+K'})`}
        aria-label="Search expenses"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 min-w-0">
          <Search className="h-4 w-4 sm:h-3.5 sm:w-3.5 shrink-0" />
          <span className="hidden sm:inline truncate text-xs">Search expenses…</span>
        </span>
        <kbd className="hidden md:inline-flex items-center rounded border border-border/80 bg-background/80 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground shrink-0">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Search expenses"
          className="fixed inset-x-3 top-15 z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in-50 zoom-in-95 overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-96 sm:max-w-[calc(100vw-2rem)]"
        >
          <div className="p-2.5 border-b border-border/60">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search merchant, note, or reference…"
                className="w-full h-9 pl-8.5 pr-8 text-xs rounded-lg border border-input bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Clear search query"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {query.trim().length > 0 && (
              <button
                type="button"
                onClick={() => handleSearch(query)}
                className="mt-2 w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary text-xs font-medium transition-colors cursor-pointer"
              >
                <span className="truncate">Search expenses for &ldquo;{query.trim()}&rdquo;</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 ml-2" />
              </button>
            )}
          </div>

          {history.length > 0 ? (
            <div className="p-1.5">
              <div className="flex items-center justify-between px-2 py-1 text-[11px] font-medium text-muted-foreground">
                <span>Recent</span>
                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  Clear
                </button>
              </div>

              <div className="space-y-0.5">
                {history.map((item) => (
                  <div
                    key={item}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSearch(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch(item)
                    }}
                    className="group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-accent/70 transition-colors cursor-pointer text-foreground w-full min-w-0"
                  >
                    <span className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="truncate">{item}</span>
                    </span>
                    <button
                      type="button"
                      onClick={(e) => removeHistoryItem(e, item)}
                      className="sm:opacity-0 sm:group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-opacity cursor-pointer shrink-0"
                      aria-label={`Remove ${item} from recent searches`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !query.trim() && (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                Press <kbd className="font-mono bg-muted px-1 py-0.5 rounded border border-border/80 text-[10px]">Enter</kbd> to filter expenses across your workspace.
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}
