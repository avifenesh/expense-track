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
  // 1. Authenticate with JWT
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 2. Rate limit check
  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

  // 3. Fetch accounts for user
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

    // 4. Calculate balance for each account
    const accountsWithBalance = await Promise.all(
      accounts.map(async (account) => {
        const [income, expense] = await Promise.all([
          prisma.transaction.aggregate({
            where: { accountId: account.id, type: 'INCOME', deletedAt: null },
            _sum: { amount: true },
          }),
          prisma.transaction.aggregate({
            where: { accountId: account.id, type: 'EXPENSE', deletedAt: null },
            _sum: { amount: true },
          }),
        ])
        return {
          ...account,
          balance: (income._sum.amount?.toNumber() || 0) - (expense._sum.amount?.toNumber() || 0),
        }
      })
    )

    return successResponse({ accounts: accountsWithBalance })
  } catch (error) {
    serverLogger.error('Failed to fetch accounts', { action: 'GET /api/v1/accounts' }, error)
    return serverError('Unable to fetch accounts')
  }
}
