import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { DashboardSkeleton } from '@/components/ui/skeleton'
import { getAccounts } from '@/lib/finance'
import { getCachedDashboardData } from '@/lib/dashboard-cache'
import { getMonthKey } from '@/utils/date'
import { getSession, updateSessionAccount, getDbUserAsAuthUser } from '@/lib/auth-server'
import { getSubscriptionState } from '@/lib/subscription'
import { logger } from '@/lib/server-logger'
import type { SubscriptionBannerData } from '@/components/subscription'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

async function DashboardLoader({
  monthKey,
  accountId,
  allowedAccounts,
  preferredCurrency,
  allAccounts,
  subscription,
  userId,
  userEmail,
}: {
  monthKey: string
  accountId: string
  allowedAccounts: Awaited<ReturnType<typeof getAccounts>>
  preferredCurrency?: import('@prisma/client').Currency
  allAccounts: Awaited<ReturnType<typeof getAccounts>>
  subscription: SubscriptionBannerData | null
  userId: string
  userEmail: string
}) {
  const data = await getCachedDashboardData({
    monthKey,
    accountId,
    preferredCurrency,
    accounts: allAccounts,
    userId,
  })

  return (
    <DashboardPage
      data={{ ...data, accounts: allowedAccounts }}
      monthKey={monthKey}
      accountId={accountId}
      subscription={subscription}
      userEmail={userEmail}
    />
  )
}

export default async function Page({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const authUser = await getDbUserAsAuthUser(session.userEmail)
  if (!authUser) {
    redirect('/login?reason=unknown-user')
  }

  // Redirect to onboarding if user hasn't completed it yet
  if (!authUser.hasCompletedOnboarding) {
    redirect('/onboarding')
  }

  const currentMonth = getMonthKey(new Date())
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const monthParamRaw = resolvedSearchParams.month
  const accountParamRaw = resolvedSearchParams.account

  const monthParam = Array.isArray(monthParamRaw) ? monthParamRaw[0] : monthParamRaw
  const accountParam = Array.isArray(accountParamRaw) ? accountParamRaw[0] : accountParamRaw

  const monthKey = typeof monthParam === 'string' && monthParam.length >= 7 ? monthParam : currentMonth

  const accounts = await getAccounts(authUser.id)
  const allowedAccountNames = new Set(authUser.accountNames)
  const allowedAccounts = accounts.filter((account) => allowedAccountNames.has(account.name))
  const accountLookup = new Map(allowedAccounts.map((account) => [account.id, account]))

  const serverActiveAccountId = authUser.activeAccountId && accountLookup.has(authUser.activeAccountId) ? authUser.activeAccountId : undefined
  const sessionAccountId = session.accountId && accountLookup.has(session.accountId) ? session.accountId : undefined
  const queryAccountId = typeof accountParam === 'string' && accountLookup.has(accountParam) ? accountParam : undefined

  const accountId = queryAccountId ?? serverActiveAccountId ?? sessionAccountId ?? allowedAccounts[0]?.id

  if (!accountId) {
    redirect('/login?reason=no-accounts')
  }

  // Try to sync session account, but don't fail if cookies can't be set
  // (cookies can only be modified in Server Actions, not Server Components in Next.js 15+)
  if (session.accountId !== accountId) {
    try {
      const updateResult = await updateSessionAccount(accountId)
      if ('error' in updateResult) {
        // Non-fatal: dashboard can still work with URL param specifying account
        logger.debug('Session account sync returned error (non-fatal)', {
          accountId,
          error: updateResult.error,
        })
      }
    } catch (error) {
      // Cookie update failed (expected in Server Component context)
      // Dashboard will use URL param for account selection
      logger.debug('Session account sync failed (expected in Server Component)', {
        accountId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  // Fetch subscription state for the banner
  let subscription: SubscriptionBannerData | null = null
  try {
    const subState = await getSubscriptionState(authUser.id)
    subscription = {
      status: subState.status,
      daysRemaining: subState.daysRemaining,
      trialEndsAt: subState.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: subState.currentPeriodEnd?.toISOString() ?? null,
    }
  } catch {
    // If subscription check fails, don't block the dashboard
    subscription = null
  }

  if (accountId && typeof accountParam === 'string' && accountParam !== accountId) {
    const nextParams = new URLSearchParams()
    nextParams.set('account', accountId)
    if (monthKey) {
      nextParams.set('month', monthKey)
    }
    const target = nextParams.toString()
    redirect(target ? `/?${target}` : '/')
  }

  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardLoader
        monthKey={monthKey}
        accountId={accountId}
        allowedAccounts={allowedAccounts}
        preferredCurrency={authUser.preferredCurrency}
        allAccounts={accounts}
        subscription={subscription}
        userId={authUser.id}
        userEmail={authUser.email}
      />
    </Suspense>
  )
}
