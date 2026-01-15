import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { RegisterCard } from '@/components/auth/register-card'
import { getSession } from '@/lib/auth-server'

export const metadata: Metadata = {
  title: 'Create account · Balance Beacon',
  description: 'Create your account to start tracking your finances.',
}

export default async function RegisterPage() {
  const session = await getSession()

  if (session) {
    redirect('/')
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-16 text-slate-100 sm:px-8">
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(94,234,212,0.18),_transparent_55%),_linear-gradient(145deg,_#020617_0%,_#0f172a_55%,_#020617_100%)]"
        aria-hidden
      />
      <div
        className="absolute inset-y-0 right-0 -z-10 hidden w-[45%] bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.22),_transparent_60%)] blur-3xl lg:block"
        aria-hidden
      />

      <div className="relative grid w-full max-w-6xl gap-12 lg:grid-cols-[1.15fr_1fr] lg:items-center">
        <section className="space-y-8 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-lg lg:p-12">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200">
            Balance Beacon
          </span>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold tracking-tight text-white md:text-5xl">
              Take control of your finances
            </h1>
            <p className="max-w-xl text-base text-slate-200/80">
              Create your free account to start tracking expenses, managing budgets, and planning your financial future.
            </p>
          </div>

          <dl className="grid gap-4 text-sm">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              <p>
                After registration, you will receive a verification email. Click the link to activate your account and
                start using Balance Beacon.
              </p>
            </div>
          </dl>
        </section>

        <RegisterCard />
      </div>
    </main>
  )
}
