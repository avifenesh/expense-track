'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/utils/cn'
import { searchAll, getSuggestedSearches, type SearchResult } from '@/lib/help-search'
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
  const [isFocused, setIsFocused] = useState(false)

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
  }, [])

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
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
      {isFocused && !query && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400">Popular searches:</p>
          <div className="flex flex-wrap gap-2">
            {suggestedSearches.slice(0, 6).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onMouseDown={(e) => {
                  // Prevent blur before click
                  e.preventDefault()
                  handleSuggestionClick(suggestion)
                }}
                className="rounded-full bg-white/10 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-white/20 hover:text-white"
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

interface SearchResultsDisplayProps {
  results: SearchResult[]
  query: string
  onFAQClick?: (faq: FAQItem) => void
  onArticleClick?: (article: HelpArticle) => void
}

export function SearchResultsDisplay({ results, query, onFAQClick, onArticleClick }: SearchResultsDisplayProps) {
  if (!query) return null

  if (results.length === 0) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/10 p-8 text-center backdrop-blur">
        <p className="text-sm text-slate-300">No results found for &quot;{query}&quot;</p>
        <p className="mt-2 text-xs text-slate-400">Try different keywords or browse the categories below.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-400">
        Found {results.length} {results.length === 1 ? 'result' : 'results'} for &quot;{query}&quot;
      </p>
      <div className="space-y-2">
        {results.map((result) => {
          if (result.type === 'faq') {
            const faq = result.item as FAQItem
            return (
              <button
                key={faq.id}
                type="button"
                onClick={() => onFAQClick?.(faq)}
                className="block w-full rounded-xl border border-white/15 bg-white/10 p-4 text-left transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="mb-1 inline-block rounded bg-sky-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-sky-300">
                      FAQ
                    </span>
                    <p className="text-sm font-medium text-white">{faq.question}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-400">{faq.answer}</p>
                  </div>
                </div>
              </button>
            )
          }

          const article = result.item as HelpArticle
          return (
            <button
              key={article.slug}
              type="button"
              onClick={() => onArticleClick?.(article)}
              className="block w-full rounded-xl border border-white/15 bg-white/10 p-4 text-left transition-colors hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="mb-1 inline-block rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300">
                    Article
                  </span>
                  <p className="text-sm font-medium text-white">{article.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{article.summary}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
