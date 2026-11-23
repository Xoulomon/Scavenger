import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Clock, Package, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getSearchHistory, addSearchHistory } from '@/lib/searchStorage'
import { useSearch, useDebounce } from '@/hooks/useSearch'
import type { SearchResult } from '@/lib/searchStorage'

const MAX_PREVIEW = 5
const MAX_HISTORY = 5

export function SearchBar() {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [query, setQuery] = useState('')
  const [isFocused, setIsFocused] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  const debouncedQuery = useDebounce(query, 300)
  const results = useSearch(debouncedQuery)

  // Load history when dropdown opens
  useEffect(() => {
    if (isFocused) {
      setHistory(getSearchHistory().slice(0, MAX_HISTORY))
    }
  }, [isFocused])

  // Keyboard shortcuts: Cmd+K / Ctrl+K to focus, Escape to clear+blur
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && document.activeElement === inputRef.current) {
        setQuery('')
        inputRef.current?.blur()
        setIsFocused(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback(
    (selectedQuery: string) => {
      addSearchHistory(selectedQuery)
      setQuery(selectedQuery)
      setIsFocused(false)
      navigate(`/search?q=${encodeURIComponent(selectedQuery)}`)
    },
    [navigate]
  )

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && query.trim()) {
      handleSelect(query.trim())
    }
  }

  const previewResults = results.slice(0, MAX_PREVIEW)
  const showDropdown = isFocused && (query === '' ? history.length > 0 : previewResults.length > 0)

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      {/* Input */}
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDownInput}
          placeholder="Search… (⌘K)"
          aria-label="Search"
          className={cn(
            'h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm',
            'placeholder:text-muted-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
          )}
        />
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div
          role="listbox"
          aria-label="Search suggestions"
          className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border bg-popover shadow-md"
        >
          {query === '' ? (
            // History entries
            <>
              <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Recent</p>
              {history.map((entry) => (
                <button
                  key={entry}
                  role="option"
                  aria-selected={false}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(entry)
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{entry}</span>
                </button>
              ))}
            </>
          ) : (
            // Inline results
            previewResults.map((result) => (
              <SearchResultItem
                key={`${result.type}-${result.id}`}
                result={result}
                onSelect={() => handleSelect(query.trim())}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function SearchResultItem({ result, onSelect }: { result: SearchResult; onSelect: () => void }) {
  const Icon = result.type === 'waste' ? Package : User

  return (
    <button
      role="option"
      aria-selected={false}
      onMouseDown={(e) => {
        e.preventDefault()
        onSelect()
      }}
      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 text-left">
        <p className="truncate font-medium">{result.label}</p>
        <p className="truncate text-xs text-muted-foreground">{result.sublabel}</p>
      </div>
    </button>
  )
}
