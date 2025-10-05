import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginCard } from '@/components/auth/login-card'
import { AUTH_USER, RECOVERY_CONTACTS } from '@/lib/auth'
import { getAccounts } from '@/lib/finance'
import { getSession } from '@/lib/auth-server'

export const metadata: Metadata = {
  title: 'Sign in · Balance Beacon',
  description: 'Authenticate with the steward credentials and focus on the account that needs your attention.',
}

export default async function LoginPage() {
  const session = await getSession()
  if (session) {
    redirect('/')
  }

  const accounts = await getAccounts()

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16 text-slate-100 sm:px-8">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_55%),_linear-gradient(145deg,_#020617_0%,_#0f172a_55%,_#020617_100%)]"
        aria-hidden
      />
      <div className="absolute inset-y-0 right-0 -z-10 hidden w-[45%] bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.22),_transparent_60%)] blur-3xl lg:block" aria-hidden />

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
              Inspired by hierarchy and focus guidance from Apple&rsquo;s Human Interface Guidelines and Microsoft&rsquo;s dashboard
              recommendations, the workspace keeps signal above noise. Pick an account, review curated KPIs, and act without
              scrolling marathons.
            </p>
          </div>

          <dl className="grid gap-4 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-300">Shared steward username</dt>
              <dd className="mt-1 text-base font-semibold text-white">{AUTH_USER.username}</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-300">Recovery inboxes</dt>
              <dd className="mt-2 space-y-1">
                {RECOVERY_CONTACTS.map((contact) => (
                  <p key={contact.email} className="text-sm text-slate-200/80">
                    <span className="font-medium text-slate-100">{contact.email}</span>
                    <span className="ml-2 text-xs uppercase tracking-wide text-slate-400">{contact.label}</span>
                  </p>
                ))}
              </dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p>
                Keep the password manager in sync after any reset. A confirmation email outlines the process and reiterates the
                canonical password so the team moves together.
              </p>
            </div>
          </dl>
        </section>

        <LoginCard accounts={accounts.map((account) => ({ id: account.id, name: account.name }))} />
      </div>
    </main>
  )
}
