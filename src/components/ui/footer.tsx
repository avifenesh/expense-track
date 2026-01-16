import Link from 'next/link'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="mt-auto border-t border-white/10 bg-slate-950/50">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
            <Link
              href="/pricing"
              className="text-slate-400 transition-colors hover:text-slate-200"
            >
              Pricing
            </Link>
            <Link
              href="/terms"
              className="text-slate-400 transition-colors hover:text-slate-200"
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className="text-slate-400 transition-colors hover:text-slate-200"
            >
              Privacy Policy
            </Link>
          </nav>
          <p className="text-sm text-slate-500">
            &copy; {currentYear} Balance Beacon. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
