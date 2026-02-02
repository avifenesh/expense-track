'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { HelpCircle, BookOpen, MessageCircle } from 'lucide-react'
import { Footer } from '@/components/ui/footer'
import { FAQAccordion, HelpSearch, ArticleGrid, FeaturedArticle } from '@/components/help'
import {
  type FAQItem,
  type HelpArticle,
  HELP_ARTICLES,
  FAQ_CATEGORY_LABELS,
  FAQ_CATEGORY_ORDER,
  getArticlesByCategory,
} from '@/lib/help-content'

export default function HelpPage() {
  const [searchState, setSearchState] = useState<{
    query: string
    faqs: FAQItem[]
    articles: HelpArticle[]
  }>({ query: '', faqs: [], articles: [] })

  const handleSearchResults = useCallback((results: { query: string; faqs: FAQItem[]; articles: HelpArticle[] }) => {
    setSearchState(results)
  }, [])

  const isSearchActive = searchState.query.length > 0
  const featuredArticle = HELP_ARTICLES.find((a) => a.slug === 'quick-start-guide')

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <div
        className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_55%),_linear-gradient(145deg,_#020617_0%,_#0f172a_55%,_#020617_100%)]"
        aria-hidden="true"
      />

      <main className="flex-1 px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-4xl">
          {/* Back navigation */}
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back to app
            </Link>
          </div>

          {/* Header */}
          <div className="mb-12 text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200">
              <HelpCircle className="h-3.5 w-3.5" />
              Help Center
            </span>
            <h1 className="mb-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">How can we help?</h1>
            <p className="mx-auto max-w-2xl text-lg text-slate-200/80">
              Find answers to common questions, browse help articles, or get in touch with our support team.
            </p>
          </div>

          {/* Search */}
          <div className="mb-12">
            <HelpSearch onSearchResults={handleSearchResults} className="mx-auto max-w-xl" />
          </div>

          {/* Search Results */}
          {isSearchActive && (
            <div className="mb-12 space-y-8">
              {/* FAQ Results */}
              {searchState.faqs.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold text-white">
                    Frequently Asked Questions ({searchState.faqs.length})
                  </h2>
                  <FAQAccordion searchQuery={searchState.query} filteredFAQs={searchState.faqs} />
                </section>
              )}

              {/* Article Results */}
              {searchState.articles.length > 0 && (
                <section>
                  <h2 className="mb-4 text-lg font-semibold text-white">
                    Help Articles ({searchState.articles.length})
                  </h2>
                  <ArticleGrid articles={searchState.articles} />
                </section>
              )}

              {/* No Results */}
              {searchState.faqs.length === 0 && searchState.articles.length === 0 && (
                <div className="rounded-2xl border border-white/15 bg-white/10 p-8 text-center backdrop-blur">
                  <p className="text-sm text-slate-300">No results found for &quot;{searchState.query}&quot;</p>
                  <p className="mt-2 text-xs text-slate-400">Try different keywords or browse the categories below.</p>
                </div>
              )}
            </div>
          )}

          {/* Default Content (when not searching) */}
          {!isSearchActive && (
            <>
              {/* Featured Article */}
              {featuredArticle && (
                <div className="mb-12">
                  <FeaturedArticle article={featuredArticle} />
                </div>
              )}

              {/* Quick Links */}
              <div className="mb-12 grid gap-4 sm:grid-cols-3">
                <Link
                  href="#faqs"
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur transition-colors hover:bg-white/15"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20">
                    <HelpCircle className="h-5 w-5 text-sky-300" />
                  </div>
                  <div>
                    <p className="font-medium text-white">FAQs</p>
                    <p className="text-xs text-slate-400">Quick answers</p>
                  </div>
                </Link>
                <Link
                  href="#articles"
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur transition-colors hover:bg-white/15"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                    <BookOpen className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Articles</p>
                    <p className="text-xs text-slate-400">In-depth guides</p>
                  </div>
                </Link>
                <a
                  href="mailto:support@balancebeacon.app"
                  className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur transition-colors hover:bg-white/15"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/20">
                    <MessageCircle className="h-5 w-5 text-violet-300" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Contact</p>
                    <p className="text-xs text-slate-400">Get support</p>
                  </div>
                </a>
              </div>

              {/* FAQs Section */}
              <section id="faqs" className="mb-16 scroll-mt-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20">
                    <HelpCircle className="h-5 w-5 text-sky-300" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Frequently Asked Questions</h2>
                    <p className="text-sm text-slate-400">Find quick answers to common questions</p>
                  </div>
                </div>
                <FAQAccordion />
              </section>

              {/* Articles Section */}
              <section id="articles" className="scroll-mt-8">
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                    <BookOpen className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-white">Help Articles</h2>
                    <p className="text-sm text-slate-400">In-depth guides and tutorials</p>
                  </div>
                </div>

                <div className="space-y-8">
                  {FAQ_CATEGORY_ORDER.map((category) => {
                    const articles = getArticlesByCategory(category)
                    if (articles.length === 0) return null

                    return (
                      <div key={category}>
                        <h3 className="mb-4 text-lg font-medium text-white">{FAQ_CATEGORY_LABELS[category]}</h3>
                        <ArticleGrid articles={articles} showCategory={false} />
                      </div>
                    )
                  })}
                </div>
              </section>
            </>
          )}

          {/* Contact Section */}
          <div className="mt-16 rounded-3xl border border-white/15 bg-gradient-to-br from-violet-500/10 to-sky-500/10 p-8 text-center backdrop-blur">
            <MessageCircle className="mx-auto mb-4 h-8 w-8 text-violet-300" />
            <h2 className="mb-2 text-xl font-semibold text-white">Still need help?</h2>
            <p className="mb-4 text-sm text-slate-300">Our support team is here to assist you with any questions.</p>
            <a
              href="mailto:support@balancebeacon.app"
              className="inline-flex items-center gap-2 rounded-full bg-white/20 px-6 py-3 font-medium text-white transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Contact Support
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
