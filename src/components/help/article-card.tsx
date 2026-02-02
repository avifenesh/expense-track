import Link from 'next/link'
import { ArrowRight, BookOpen } from 'lucide-react'
import { cn } from '@/utils/cn'
import { type HelpArticle, FAQ_CATEGORY_LABELS } from '@/lib/help-content'

interface ArticleCardProps {
  article: HelpArticle
  /** Whether to show the category badge */
  showCategory?: boolean
  /** Additional class name */
  className?: string
}

export function ArticleCard({ article, showCategory = true, className }: ArticleCardProps) {
  return (
    <Link
      href={`/help/${article.slug}`}
      className={cn(
        'group block rounded-2xl border border-white/15 bg-white/10 p-5 backdrop-blur transition-all hover:border-white/25 hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-500/20">
          <BookOpen className="h-5 w-5 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          {showCategory && (
            <span className="mb-1 inline-block rounded bg-white/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300">
              {FAQ_CATEGORY_LABELS[article.category]}
            </span>
          )}
          <h3 className="font-medium text-white transition-colors group-hover:text-sky-300">{article.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-slate-300">{article.summary}</p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-300 transition-colors group-hover:text-sky-200">
            Read article
            <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  )
}

interface ArticleGridProps {
  articles: HelpArticle[]
  /** Whether to show category badges */
  showCategory?: boolean
  /** Additional class name for the grid container */
  className?: string
  /** Empty state message */
  emptyMessage?: string
}

export function ArticleGrid({
  articles,
  showCategory = true,
  className,
  emptyMessage = 'No articles available.',
}: ArticleGridProps) {
  if (articles.length === 0) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/10 p-8 text-center backdrop-blur">
        <p className="text-sm text-slate-300">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', className)}>
      {articles.map((article) => (
        <ArticleCard key={article.slug} article={article} showCategory={showCategory} />
      ))}
    </div>
  )
}

interface FeaturedArticleProps {
  article: HelpArticle
  className?: string
}

export function FeaturedArticle({ article, className }: FeaturedArticleProps) {
  return (
    <Link
      href={`/help/${article.slug}`}
      className={cn(
        'group block overflow-hidden rounded-3xl border border-white/15 bg-gradient-to-br from-emerald-500/10 to-sky-500/10 p-6 backdrop-blur transition-all hover:border-white/25 hover:from-emerald-500/15 hover:to-sky-500/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400/40',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/10">
          <BookOpen className="h-6 w-6 text-emerald-300" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="mb-2 inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
            Featured Guide
          </span>
          <h3 className="text-lg font-semibold text-white transition-colors group-hover:text-sky-300">
            {article.title}
          </h3>
          <p className="mt-2 text-sm text-slate-300">{article.summary}</p>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sky-300 transition-colors group-hover:text-sky-200">
            Start reading
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  )
}
