import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import {
  authError,
  serverError,
  successResponse,
  rateLimitError,
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { serverLogger } from '@/lib/server-logger'

/**
 * GET /api/v1/accounts
 *
 * Retrieves all accounts for the authenticated user with calculated balances.
 *
 * @returns {Object} { accounts: [{ id, name, type, preferredCurrency, color, icon, description, balance }] }
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to fetch accounts
 */
export async function GET(request: NextRequest) {
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

  try {
    const accounts = await prisma.account.findMany({
      where: {
        userId: user.userId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        type: true,
        preferredCurrency: true,
        color: true,
        icon: true,
        description: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    if (accounts.length === 0) {
      return successResponse({ accounts: [] })
    }

    const accountIds = accounts.map((acc) => acc.id)
    const aggregates = await prisma.transaction.groupBy({
      by: ['accountId', 'type'],
      where: { accountId: { in: accountIds }, deletedAt: null },
      _sum: { amount: true },
    })

    const balances = new Map<string, number>()
    for (const { accountId, type, _sum } of aggregates) {
      const amount = _sum.amount?.toNumber() || 0
      const currentBalance = balances.get(accountId) || 0
      balances.set(accountId, currentBalance + (type === 'INCOME' ? amount : -amount))
    }

    const accountsWithBalance = accounts.map((account) => ({
      ...account,
      balance: balances.get(account.id) || 0,
    }))

    return successResponse({ accounts: accountsWithBalance })
  } catch (error) {
    serverLogger.error('Failed to fetch accounts', { action: 'GET /api/v1/accounts' }, error)
    return serverError('Unable to fetch accounts')
  }
}
