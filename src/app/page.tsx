import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { getAccounts, getDashboardData } from '@/lib/finance'
import { getMonthKey } from '@/utils/date'
import { getSession, updateSessionAccount } from '@/lib/auth-server'
import { AUTH_USERS } from '@/lib/auth'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

async function DashboardLoader({
  monthKey,
  accountId,
  allowedAccounts,
}: {
  monthKey: string
  accountId: string
  allowedAccounts: Awaited<ReturnType<typeof getAccounts>>
}) {
  const data = await getDashboardData({
    monthKey,
    accountId,
  })

  return <DashboardPage data={{ ...data, accounts: allowedAccounts }} monthKey={monthKey} accountId={accountId} />
}

export default async function Page({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const authUserRecord = AUTH_USERS.find((user) => user.email.toLowerCase() === session.userEmail.toLowerCase())
  if (!authUserRecord) {
    redirect('/login?reason=unknown-user')
  }
  const authUser = authUserRecord

  const currentMonth = getMonthKey(new Date())
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const monthParamRaw = resolvedSearchParams.month
  const accountParamRaw = resolvedSearchParams.account

  const monthParam = Array.isArray(monthParamRaw) ? monthParamRaw[0] : monthParamRaw
  const accountParam = Array.isArray(accountParamRaw) ? accountParamRaw[0] : accountParamRaw

  const monthKey = typeof monthParam === 'string' && monthParam.length >= 7 ? monthParam : currentMonth

  const accounts = await getAccounts()
  const allowedAccountNames = new Set(authUser.accountNames)
  const allowedAccounts = accounts.filter((account) => allowedAccountNames.has(account.name))
  const accountLookup = new Map(allowedAccounts.map((account) => [account.id, account]))

  const sessionAccountId = session.accountId && accountLookup.has(session.accountId) ? session.accountId : undefined
  const queryAccountId = typeof accountParam === 'string' && accountLookup.has(accountParam) ? accountParam : undefined

  let accountId = queryAccountId ?? sessionAccountId ?? allowedAccounts[0]?.id

  if (!accountId) {
    redirect('/login?reason=no-accounts')
  }

  if (session.accountId !== accountId) {
    const updateResult = await updateSessionAccount(accountId)
    if ('error' in updateResult) {
      console.error('updateSessionAccount failed', updateResult.error)
      redirect('/login?reason=account-access')
    }
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
    <Suspense fallback={<div className="p-8 text-sm text-gray-500">Loading dashboard…</div>}>
      <DashboardLoader monthKey={monthKey} accountId={accountId} allowedAccounts={allowedAccounts} />
    </Suspense>
  )
}
