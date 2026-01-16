import { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession, getDbUserAsAuthUser } from '@/lib/auth-server'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Welcome - Balance Beacon',
  description: 'Set up your account and start tracking your finances.',
}

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    redirect('/login?reason=unknown-user')
  }

  if (authUser.hasCompletedOnboarding) {
    redirect('/')
  }

  const accounts = await prisma.account.findMany({
    where: { userId: authUser.id },
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  })

  const existingCategories = await prisma.category.findMany({
    where: { userId: authUser.id, isArchived: false },
    select: { id: true, name: true, type: true },
  })

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

      <OnboardingWizard
        displayName={authUser.displayName}
        preferredCurrency={authUser.preferredCurrency}
        accounts={accounts}
        existingCategoriesCount={existingCategories.length}
      />
    </main>
  )
}
