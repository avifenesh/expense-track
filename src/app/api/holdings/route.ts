import { NextResponse } from 'next/server'
import { Currency } from '@prisma/client'
import { getHoldingsWithPrices, getAccounts } from '@/lib/finance'
import { requireSession, getDbUserAsAuthUser } from '@/lib/auth-server'

export const dynamic = 'force-dynamic'

function isCurrency(value: string | null): value is Currency {
  if (!value) return false
  return (Object.values(Currency) as string[]).includes(value)
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const accountIdParam = url.searchParams.get('accountId')
  const preferredCurrencyParam = url.searchParams.get('preferredCurrency')

  try {
    const session = await requireSession()
    const authUser = await getDbUserAsAuthUser(session.userEmail)

    if (!authUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    const accounts = await getAccounts(authUser.id)
    const allowedAccountNames = new Set(authUser.accountNames.map((name: string) => name.toLowerCase()))
    const allowedAccounts = accounts.filter((account) => allowedAccountNames.has(account.name.toLowerCase()))

    if (allowedAccounts.length === 0) {
      return NextResponse.json({ error: 'No accessible accounts' }, { status: 404 })
    }

    const resolvedAccountId =
      accountIdParam && allowedAccounts.some((account) => account.id === accountIdParam)
        ? accountIdParam
        : allowedAccounts[0].id

    const preferredCurrencyRaw = preferredCurrencyParam?.toUpperCase() ?? null
    const preferredCurrency = isCurrency(preferredCurrencyRaw)
      ? (preferredCurrencyRaw as Currency)
      : authUser.preferredCurrency

    const holdings = await getHoldingsWithPrices({
      accountId: resolvedAccountId,
      preferredCurrency,
    })

    return NextResponse.json({
      holdings,
      accountId: resolvedAccountId,
    })
  } catch (error) {
    const status = error instanceof Error && error.message === 'Unauthenticated' ? 401 : 500
    return NextResponse.json({ error: 'Failed to load holdings' }, { status })
  }
}
