import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { DashboardPage } from '@/components/dashboard/dashboard-page'
import { getAccounts, getDashboardData } from '@/lib/finance'
import { getMonthKey } from '@/utils/date'
import { getSession, updateSessionAccount } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

async function DashboardLoader({ monthKey, accountId }: { monthKey: string; accountId: string }) {
  const data = await getDashboardData({
    monthKey,
    accountId,
  })

  return <DashboardPage data={data} monthKey={monthKey} accountId={accountId} />
}

export default async function Page({ searchParams }: PageProps) {
  const session = await getSession()
  if (!session) {
    redirect('/login')
  }

  const currentMonth = getMonthKey(new Date())
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const monthParamRaw = resolvedSearchParams.month
  const accountParamRaw = resolvedSearchParams.account

  const monthParam = Array.isArray(monthParamRaw) ? monthParamRaw[0] : monthParamRaw
  const accountParam = Array.isArray(accountParamRaw) ? accountParamRaw[0] : accountParamRaw

  const monthKey = typeof monthParam === 'string' && monthParam.length >= 7 ? monthParam : currentMonth

  const accounts = await getAccounts()
  const accountLookup = new Map(accounts.map((account) => [account.id, account]))

  const sessionAccountId = session.accountId && accountLookup.has(session.accountId) ? session.accountId : undefined
  const queryAccountId = typeof accountParam === 'string' && accountLookup.has(accountParam) ? accountParam : undefined

  let accountId = queryAccountId ?? sessionAccountId ?? accounts[0]?.id

  if (!accountId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-8 text-slate-100">
        <div className="max-w-md space-y-3 text-center">
          <h1 className="text-2xl font-semibold">Let&rsquo;s create your first account</h1>
          <p className="text-sm text-slate-300">
            No accounts were found in the database. Add one via the seed script or Prisma Studio, then refresh to begin tracking balances.
          </p>
        </div>
      </div>
    )
  }

  if (session.accountId !== accountId) {
    const updateResult = await updateSessionAccount(accountId)
    if ('error' in updateResult) {
      console.error('updateSessionAccount failed', updateResult.error)
    }
  }

  if (typeof accountParam === 'string' && accountParam !== accountId) {
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
      <DashboardLoader monthKey={monthKey} accountId={accountId} />
    </Suspense>
  )
}
