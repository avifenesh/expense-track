'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/utils/cn'
import { searchAll, getSuggestedSearches } from '@/lib/help-search'
import { type FAQItem, type HelpArticle } from '@/lib/help-content'

interface HelpSearchProps {
  /** Callback when search results change */
  onSearchResults: (results: { query: string; faqs: FAQItem[]; articles: HelpArticle[] }) => void
  /** Debounce delay in ms */
  debounceMs?: number
  /** Placeholder text */
  placeholder?: string
  /** Additional class name */
  className?: string
}

export function HelpSearch({
  onSearchResults,
  debounceMs = 300,
  placeholder = 'Search FAQs and articles...',
  className,
}: HelpSearchProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [query, debounceMs])

  // Perform search when debounced query changes
  useEffect(() => {
    if (!debouncedQuery.trim()) {
      onSearchResults({ query: '', faqs: [], articles: [] })
      return
    }

    const results = searchAll(debouncedQuery)

    // Separate FAQs and articles
    const faqs: FAQItem[] = []
    const articles: HelpArticle[] = []

    for (const result of results) {
      if (result.type === 'faq') {
        faqs.push(result.item as FAQItem)
      } else {
        articles.push(result.item as HelpArticle)
      }
    }

    onSearchResults({ query: debouncedQuery, faqs, articles })
  }, [debouncedQuery, onSearchResults])

  const handleClear = useCallback(() => {
    setQuery('')
    setDebouncedQuery('')
    onSearchResults({ query: '', faqs: [], articles: [] })
  }, [onSearchResults])

  const suggestedSearches = useMemo(() => getSuggestedSearches(), [])

  const handleSuggestionClick = useCallback((suggestion: string) => {
    setQuery(suggestion)
    setDebouncedQuery(suggestion)
    setShowSuggestions(false)
  }, [])

  // Handle focus within container (keeps suggestions open when tabbing to suggestion buttons)
  const handleContainerBlur = useCallback((e: React.FocusEvent) => {
    // Check if the new focus target is within the container
    if (!containerRef.current?.contains(e.relatedTarget as Node)) {
      setShowSuggestions(false)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={cn('space-y-3', className)}
      onFocus={() => setShowSuggestions(true)}
      onBlur={handleContainerBlur}
    >
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="pl-10 pr-10"
          aria-label="Search help content"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Suggested searches shown when focused and no query */}
      {showSuggestions && !query && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Popular searches:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedSearches.slice(0, 6).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-white/20 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search indicator */}
      {query && query !== debouncedQuery && <p className="text-xs text-slate-400">Searching...</p>}
    </div>
  )
}
