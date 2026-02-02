import { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BookOpen, HelpCircle } from 'lucide-react'
import { Footer } from '@/components/ui/footer'
import { ArticleCard } from '@/components/help'
import { ArticleContent } from '@/components/help/article-content'
import {
  getArticleBySlug,
  getArticlesByCategory,
  HELP_ARTICLES,
  FAQ_CATEGORY_LABELS,
  FAQ_ITEMS,
} from '@/lib/help-content'

interface ArticlePageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article) {
    return {
      title: 'Article Not Found - Balance Beacon Help',
    }
  }

  return {
    title: `${article.title} - Balance Beacon Help`,
    description: article.summary,
  }
}

export function generateStaticParams() {
  return HELP_ARTICLES.map((article) => ({
    slug: article.slug,
  }))
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params
  const article = getArticleBySlug(slug)

  if (!article) {
    notFound()
  }

  // Get related FAQs
  const relatedFaqs = article.relatedFaqs ? FAQ_ITEMS.filter((faq) => article.relatedFaqs?.includes(faq.id)) : []

  // Get other articles in the same category (excluding current)
  const relatedArticles = getArticlesByCategory(article.category)
    .filter((a) => a.slug !== article.slug)
    .slice(0, 2)

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <div
        className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_55%),_linear-gradient(145deg,_#020617_0%,_#0f172a_55%,_#020617_100%)]"
        aria-hidden="true"
      />

      <main className="flex-1 px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl">
          {/* Navigation */}
          <div className="mb-8 flex items-center gap-4">
            <Link
              href="/help"
              className="inline-flex items-center gap-2 text-sm text-slate-400 transition-colors hover:text-slate-200"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Help Center
            </Link>
          </div>

          {/* Article Header */}
          <header className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20">
                <BookOpen className="h-5 w-5 text-emerald-300" />
              </div>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-slate-300">
                {FAQ_CATEGORY_LABELS[article.category]}
              </span>
            </div>
            <h1 className="mb-4 text-3xl font-semibold tracking-tight text-white md:text-4xl">{article.title}</h1>
            <p className="text-lg text-slate-300">{article.summary}</p>
          </header>

          {/* Article Content */}
          <article className="prose prose-invert prose-slate max-w-none prose-headings:font-semibold prose-h1:text-3xl prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3 prose-p:text-slate-300 prose-li:text-slate-300 prose-a:text-sky-300 hover:prose-a:text-sky-200 prose-strong:text-white prose-code:text-sky-300 prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded">
            <ArticleContent content={article.content} />
          </article>

          {/* Related FAQs */}
          {relatedFaqs.length > 0 && (
            <section className="mt-12 rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur">
              <div className="mb-4 flex items-center gap-3">
                <HelpCircle className="h-5 w-5 text-sky-300" />
                <h2 className="text-lg font-semibold text-white">Related Questions</h2>
              </div>
              <div className="space-y-4">
                {relatedFaqs.map((faq) => (
                  <div key={faq.id} className="border-b border-white/10 pb-4 last:border-b-0 last:pb-0">
                    <p className="font-medium text-white">{faq.question}</p>
                    <p className="mt-1 text-sm text-slate-300">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <section className="mt-8">
              <h2 className="mb-4 text-lg font-semibold text-white">More in {FAQ_CATEGORY_LABELS[article.category]}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {relatedArticles.map((relatedArticle) => (
                  <ArticleCard key={relatedArticle.slug} article={relatedArticle} showCategory={false} />
                ))}
              </div>
            </section>
          )}

          {/* Help Footer */}
          <div className="mt-12 rounded-2xl border border-white/15 bg-white/10 p-6 text-center backdrop-blur">
            <p className="mb-3 text-sm text-slate-300">Was this article helpful?</p>
            <p className="text-xs text-slate-400">
              Still have questions?{' '}
              <a href="mailto:support@balancebeacon.app" className="text-sky-300 hover:text-sky-200">
                Contact support
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
