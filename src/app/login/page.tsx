import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginCard } from '@/components/auth/login-card'
import { Footer } from '@/components/ui/footer'
import { getAccounts } from '@/lib/finance'
import { getSession, getDbUserAsAuthUser } from '@/lib/auth-server'

export const metadata: Metadata = {
  title: 'Sign in - Balance Beacon',
  description: 'Authenticate with the steward credentials and focus on the account that needs your attention.',
}

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

const ERROR_MESSAGES: Record<string, string> = {
  'no-accounts': 'No accounts were found for this login. Please contact your administrator to have an account created.',
  'account-access': 'You tried to open an account that is not assigned to your login. Pick one of your accounts.',
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const reasonParam = resolvedSearchParams.reason
  const reason = Array.isArray(reasonParam) ? reasonParam[0] : reasonParam
  const reasonMessage = reason ? (ERROR_MESSAGES[reason] ?? 'Please sign in to continue.') : undefined

  const session = await getSession()
  const accounts = await getAccounts()

  if (session) {
    const authUser = await getDbUserAsAuthUser(session.userEmail)
    if (authUser) {
      const allowedAccounts = accounts.filter((account) => authUser.accountNames.includes(account.name))
      if (allowedAccounts.length > 0) {
        const fallbackAccount =
          allowedAccounts.find((account) => account.id === session.accountId)?.id ?? allowedAccounts[0].id
        redirect(`/?account=${fallbackAccount}`)
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col text-slate-100">
      <div
        className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_55%),_linear-gradient(145deg,_#020617_0%,_#0f172a_55%,_#020617_100%)]"
        aria-hidden
      />
      <div
        className="fixed inset-y-0 right-0 -z-10 hidden w-[45%] bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.22),_transparent_60%)] blur-3xl lg:block"
        aria-hidden
      />

      <main className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-16 sm:px-8">
        <div className="relative grid w-full max-w-6xl gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <section className="space-y-8 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-lg lg:p-12">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200">
              Balance Beacon
            </span>
            <div className="space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
                Plan confidently, one account at a time
              </h1>
              <p className="max-w-xl text-base text-slate-200/80">
                Sign in with your personal credentials to focus on your household accounts and shared plans without
                overlap.
              </p>
            </div>

            <dl className="grid gap-4 text-sm">
              {reasonMessage && (
                <div className="rounded-2xl border border-rose-400/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {reasonMessage}
                </div>
              )}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                <p>
                  Keep your personal password manager in sync after any reset. A confirmation email outlines the process.
                </p>
              </div>
            </dl>
          </section>

          <LoginCard />
        </div>
      </main>

      <Footer />
    </div>
  )
}
