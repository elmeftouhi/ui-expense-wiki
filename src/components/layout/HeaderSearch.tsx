import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Clock, X, Trash2, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const DEFAULT_HISTORY = [
  'Software & Cloud Infrastructure budget',
  'Cloud Infrastructure Hosting',
  'Software subscriptions',
  'Travel expenses Q3',
]

const STORAGE_KEY = 'expense_wiki_search_history'

export const HeaderSearch: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) return JSON.parse(saved)
    } catch {
      // ignore
    }
    return DEFAULT_HISTORY
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

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
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  const saveHistory = (items: string[]) => {
    setHistory(items)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    } catch {
      // ignore
    }
  }

  const handleSearch = (searchTerm: string) => {
    const trimmed = searchTerm.trim()
    if (!trimmed) return

    const updated = [trimmed, ...history.filter((item) => item.toLowerCase() !== trimmed.toLowerCase())].slice(0, 8)
    saveHistory(updated)
    setIsOpen(false)
    setQuery('')

    // Navigate to expenses with search term
    navigate(`/expenses?search=${encodeURIComponent(trimmed)}`)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch(query)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  const removeHistoryItem = (e: React.MouseEvent, itemToRemove: string) => {
    e.stopPropagation()
    const updated = history.filter((item) => item !== itemToRemove)
    saveHistory(updated)
  }

  const clearAllHistory = () => {
    saveHistory([])
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Search Trigger Icon Button */}
      <button
        type="button"
        id="header-search-trigger"
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/80 bg-background/80 hover:bg-accent/60 transition-colors text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring',
          isOpen && 'bg-accent text-foreground ring-2 ring-ring/40',
        )}
        title="Search (expenses, categories, receipts)"
        aria-label="Search"
        aria-expanded={isOpen}
      >
        <Search className="h-4 w-4" />
      </button>

      {/* Search Popover with History */}
      {isOpen && (
        <div
          role="dialog"
          aria-label="Search and history"
          className="fixed inset-x-3 top-17 z-50 rounded-xl border border-border bg-card text-card-foreground shadow-2xl animate-in fade-in-50 zoom-in-95 overflow-x-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-96 sm:max-w-[calc(100vw-2rem)] sm:shadow-xl"
        >
          {/* Search Input Header */}
          <div className="p-3 border-b border-border/60">
            <div className="relative flex items-center">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search expenses, receipts, categories..."
                className="w-full h-9 pl-9 pr-8 text-xs rounded-lg border border-input bg-background/60 focus:bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2.5 p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Clear input"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>

            {query.trim().length > 0 && (
              <button
                type="button"
                onClick={() => handleSearch(query)}
                className="mt-2 w-full flex items-center justify-between px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary text-xs font-medium transition-colors cursor-pointer"
              >
                <span className="truncate">Search for &ldquo;{query.trim()}&rdquo;</span>
                <ArrowRight className="w-3.5 h-3.5 shrink-0 ml-1" />
              </button>
            )}
          </div>

          {/* Search History Section */}
          <div className="p-2 overflow-x-hidden">
            <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 text-muted-foreground" />
                Recent Searches
              </span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={clearAllHistory}
                  className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-2.5 h-2.5" />
                  <span>Clear history</span>
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No recent searches.
              </div>
            ) : (
              <div className="space-y-0.5 mt-1">
                {history.map((item) => (
                  <div
                    key={item}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSearch(item)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearch(item)
                    }}
                    className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs hover:bg-accent/70 transition-colors cursor-pointer text-foreground w-full min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                      <Clock className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                      <span className="truncate">{item}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => removeHistoryItem(e, item)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer shrink-0"
                      title="Remove from history"
                      aria-label={`Remove ${item} from history`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-border/60 bg-muted/30 text-[10px] text-muted-foreground text-center">
            Press <kbd className="font-mono bg-muted px-1 rounded border border-border">Enter</kbd> to search ledger & transactions
          </div>
        </div>
      )}
    </div>
  )
}
