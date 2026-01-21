import { Metadata } from 'next'
import Link from 'next/link'
import { Footer } from '@/components/ui/footer'
import { TRIAL_DURATION_DAYS, SUBSCRIPTION_PRICE_CENTS } from '@/lib/subscription-constants'

export const metadata: Metadata = {
  title: 'Pricing - Balance Beacon',
  description: 'Simple, transparent pricing. Start your 14-day free trial and take control of your finances for just $3/month.',
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`h-5 w-5 ${className ?? ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-label="Included"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={`h-5 w-5 ${className ?? ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-label="Not included"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

const features = [
  'Unlimited expense tracking',
  'Budget management with alerts',
  'Multi-currency support (USD, EUR, ILS)',
  'Recurring transaction templates',
  'Investment portfolio tracking',
  'Expense sharing with friends and roommates',
  'Data export (CSV)',
  'Mobile app access (iOS and Android)',
]

export default function PricingPage() {
  const priceDisplay = `$${(SUBSCRIPTION_PRICE_CENTS / 100).toFixed(0)}`

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <div
        className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_55%),_linear-gradient(145deg,_#020617_0%,_#0f172a_55%,_#020617_100%)]"
        aria-hidden="true"
      />

      <main className="flex-1 px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-4xl">
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

          <div className="mb-12 text-center">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200">
              Simple Pricing
            </span>
            <h1 className="mb-4 text-4xl font-semibold tracking-tight text-white md:text-5xl">
              One plan. Everything included.
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-slate-200/80">
              No hidden fees. No complicated tiers. Just a straightforward price for a tool that helps you understand your finances in 30 seconds.
            </p>
          </div>

          <div className="mx-auto max-w-md">
            <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-white/10 p-8 backdrop-blur-lg">
              <div className="absolute right-4 top-4">
                <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-300">
                  Most Popular
                </span>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-white">{priceDisplay}</span>
                  <span className="text-lg text-slate-400">/month</span>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  After your {TRIAL_DURATION_DAYS}-day free trial
                </p>
              </div>

              <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-center text-sm font-medium text-emerald-300">
                  Start with {TRIAL_DURATION_DAYS} days free - no credit card required
                </p>
              </div>

              <ul className="mb-8 space-y-3">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3">
                    <svg
                      className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm text-slate-200">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/register"
                className="block w-full rounded-full bg-white/20 px-6 py-3 text-center font-medium text-white transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Start Free Trial
              </Link>

              <p className="mt-4 text-center text-xs text-slate-400">
                30-day money-back guarantee. Cancel anytime.
              </p>
            </div>
          </div>

          <div className="mt-16">
            <h2 className="mb-8 text-center text-2xl font-semibold text-white">
              Free Trial vs Premium
            </h2>
            <div className="overflow-hidden rounded-2xl border border-white/15" role="table">
              <div className="grid grid-cols-1 md:grid-cols-3" role="rowgroup">
                <div className="hidden border-b border-white/15 bg-white/5 p-4 md:block" role="columnheader">
                  <span className="text-sm font-medium text-slate-400">Features</span>
                </div>
                <div className="border-b border-white/15 bg-white/5 p-4 text-center" role="columnheader">
                  <span className="text-sm font-medium text-slate-200">Free Trial</span>
                  <p className="mt-1 text-xs text-slate-400">{TRIAL_DURATION_DAYS} days</p>
                </div>
                <div className="border-b border-white/15 bg-emerald-500/10 p-4 text-center" role="columnheader">
                  <span className="text-sm font-medium text-emerald-300">Premium</span>
                  <p className="mt-1 text-xs text-emerald-300/70">{priceDisplay}/month</p>
                </div>

                <div className="border-b border-white/15 bg-white/5 p-4">
                  <span className="text-sm text-slate-200">Transaction tracking</span>
                </div>
                <div className="flex items-center justify-center border-b border-white/15 p-4">
                  <span className="text-sm text-slate-300">Limited (50)</span>
                </div>
                <div className="flex items-center justify-center border-b border-white/15 bg-emerald-500/5 p-4">
                  <span className="text-sm text-emerald-300">Unlimited</span>
                </div>

                <div className="border-b border-white/15 bg-white/5 p-4">
                  <span className="text-sm text-slate-200">Budget tracking</span>
                </div>
                <div className="flex items-center justify-center border-b border-white/15 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>
                <div className="flex items-center justify-center border-b border-white/15 bg-emerald-500/5 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>

                <div className="border-b border-white/15 bg-white/5 p-4">
                  <span className="text-sm text-slate-200">Multi-currency support</span>
                </div>
                <div className="flex items-center justify-center border-b border-white/15 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>
                <div className="flex items-center justify-center border-b border-white/15 bg-emerald-500/5 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>

                <div className="border-b border-white/15 bg-white/5 p-4">
                  <span className="text-sm text-slate-200">Expense sharing</span>
                </div>
                <div className="flex items-center justify-center border-b border-white/15 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>
                <div className="flex items-center justify-center border-b border-white/15 bg-emerald-500/5 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>

                <div className="border-b border-white/15 bg-white/5 p-4">
                  <span className="text-sm text-slate-200">Investment tracking</span>
                </div>
                <div className="flex items-center justify-center border-b border-white/15 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>
                <div className="flex items-center justify-center border-b border-white/15 bg-emerald-500/5 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>

                <div className="border-b border-white/15 bg-white/5 p-4">
                  <span className="text-sm text-slate-200">Data export (CSV)</span>
                </div>
                <div className="flex items-center justify-center border-b border-white/15 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>
                <div className="flex items-center justify-center border-b border-white/15 bg-emerald-500/5 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>

                <div className="border-b border-white/15 bg-white/5 p-4">
                  <span className="text-sm text-slate-200">Mobile app access</span>
                </div>
                <div className="flex items-center justify-center border-b border-white/15 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>
                <div className="flex items-center justify-center border-b border-white/15 bg-emerald-500/5 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>

                <div className="bg-white/5 p-4">
                  <span className="text-sm text-slate-200">Priority support</span>
                </div>
                <div className="flex items-center justify-center p-4">
                  <XIcon className="text-slate-500" />
                </div>
                <div className="flex items-center justify-center bg-emerald-500/5 p-4">
                  <CheckIcon className="text-emerald-400" />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-slate-400">
              Questions? Contact us at{' '}
              <a
                href="mailto:support@balancebeacon.app"
                className="text-sky-300 transition-colors hover:text-sky-200"
              >
                support@balancebeacon.app
              </a>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
