'use client'

import { useState, useCallback } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/utils/cn'
import {
  type FAQCategory,
  type FAQItem,
  FAQ_CATEGORY_LABELS,
  FAQ_CATEGORY_ORDER,
  getFAQsByCategory,
} from '@/lib/help-content'
import { highlightMatches } from '@/lib/help-search'

interface FAQAccordionProps {
  /** Optional search query to filter and highlight FAQs */
  searchQuery?: string
  /** Optional filtered FAQ items (when search is active) */
  filteredFAQs?: FAQItem[]
  /** Optional callback when FAQ is expanded */
  onExpand?: (faqId: string) => void
}

interface FAQItemComponentProps {
  item: FAQItem
  isExpanded: boolean
  onToggle: () => void
  searchQuery?: string
}

function FAQItemComponent({ item, isExpanded, onToggle, searchQuery }: FAQItemComponentProps) {
  const renderHighlightedText = (text: string) => {
    if (!searchQuery) return text

    const segments = highlightMatches(text, searchQuery)
    return segments.map((segment, index) =>
      segment.highlighted ? (
        <mark key={index} className="bg-sky-400/30 text-inherit rounded px-0.5">
          {segment.text}
        </mark>
      ) : (
        <span key={index}>{segment.text}</span>
      ),
    )
  }

  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-inset"
        aria-expanded={isExpanded}
        aria-controls={`faq-answer-${item.id}`}
      >
        <span className="text-sm font-medium text-white">{renderHighlightedText(item.question)}</span>
        <ChevronDown
          className={cn(
            'h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200',
            isExpanded && 'rotate-180',
          )}
        />
      </button>
      <div
        id={`faq-answer-${item.id}`}
        className={cn(
          'grid transition-all duration-200 ease-in-out',
          isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden">
          <p className="px-4 pb-4 text-sm leading-relaxed text-slate-300">{renderHighlightedText(item.answer)}</p>
        </div>
      </div>
    </div>
  )
}

interface CategorySectionProps {
  category: FAQCategory
  faqs: FAQItem[]
  expandedIds: Set<string>
  onToggle: (id: string) => void
  searchQuery?: string
  defaultOpen?: boolean
}

function CategorySection({
  category,
  faqs,
  expandedIds,
  onToggle,
  searchQuery,
  defaultOpen = false,
}: CategorySectionProps) {
  const [isCategoryOpen, setIsCategoryOpen] = useState(defaultOpen)

  if (faqs.length === 0) return null

  return (
    <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur">
      <button
        type="button"
        onClick={() => setIsCategoryOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40 focus-visible:ring-inset"
        aria-expanded={isCategoryOpen}
      >
        <div className="flex items-center gap-3">
          <span className="text-base font-semibold text-white">{FAQ_CATEGORY_LABELS[category]}</span>
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-slate-300">
            {faqs.length} {faqs.length === 1 ? 'question' : 'questions'}
          </span>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 flex-shrink-0 text-slate-400 transition-transform duration-200',
            isCategoryOpen && 'rotate-180',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-all duration-200 ease-in-out',
          isCategoryOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        )}
      >
        <div className="overflow-hidden border-t border-white/10">
          {faqs.map((item) => (
            <FAQItemComponent
              key={item.id}
              item={item}
              isExpanded={expandedIds.has(item.id)}
              onToggle={() => onToggle(item.id)}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export function FAQAccordion({ searchQuery, filteredFAQs, onExpand }: FAQAccordionProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const handleToggle = useCallback(
    (id: string) => {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
          onExpand?.(id)
        }
        return next
      })
    },
    [onExpand],
  )

  // When search is active, show filtered results in a flat list
  if (searchQuery && filteredFAQs) {
    if (filteredFAQs.length === 0) {
      return (
        <div className="rounded-2xl border border-white/15 bg-white/10 p-8 text-center backdrop-blur">
          <p className="text-sm text-slate-300">No FAQs match your search.</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        <p className="text-sm text-slate-400">
          Found {filteredFAQs.length} {filteredFAQs.length === 1 ? 'result' : 'results'}
        </p>
        <div className="overflow-hidden rounded-2xl border border-white/15 bg-white/10 backdrop-blur">
          {filteredFAQs.map((item) => (
            <FAQItemComponent
              key={item.id}
              item={item}
              isExpanded={expandedIds.has(item.id)}
              onToggle={() => handleToggle(item.id)}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      </div>
    )
  }

  // Default: show FAQs grouped by category
  const faqsByCategory = getFAQsByCategory()

  return (
    <div className="space-y-4">
      {FAQ_CATEGORY_ORDER.map((category, index) => (
        <CategorySection
          key={category}
          category={category}
          faqs={faqsByCategory[category]}
          expandedIds={expandedIds}
          onToggle={handleToggle}
          searchQuery={searchQuery}
          defaultOpen={index === 0} // First category open by default
        />
      ))}
    </div>
  )
}
