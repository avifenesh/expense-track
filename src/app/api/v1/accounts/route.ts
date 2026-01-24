import { NextRequest } from 'next/server'
import { z } from 'zod'
import { requireJwtAuth } from '@/lib/api-auth'
import {
  authError,
  serverError,
  successResponse,
  validationError,
  rateLimitError,
  checkSubscription,
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { serverLogger } from '@/lib/server-logger'

const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50, 'Name must be 50 characters or less'),
  type: z.enum(['SELF', 'PARTNER', 'OTHER']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').optional().nullable(),
  preferredCurrency: z.enum(['USD', 'EUR', 'ILS']).optional().nullable(),
})

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
      balance: Math.round((balances.get(account.id) || 0) * 100) / 100,
    }))

    return successResponse({ accounts: accountsWithBalance })
  } catch (error) {
    serverLogger.error('Failed to fetch accounts', { action: 'GET /api/v1/accounts' }, error)
    return serverError('Unable to fetch accounts')
  }
}

/**
 * POST /api/v1/accounts
 *
 * Creates a new account for the authenticated user.
 *
 * @param {Object} body - { name: string, type: 'SELF' | 'PARTNER' | 'OTHER', color?: string, preferredCurrency?: 'USD' | 'EUR' | 'ILS' }
 * @returns {Object} { id, name, type, preferredCurrency, color, icon, description }
 * @throws {400} Validation error - Invalid input or duplicate account name
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {402} Subscription required - No active subscription
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to create account
 */
export async function POST(request: NextRequest) {
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

  const subscriptionError = await checkSubscription(user.userId)
  if (subscriptionError) return subscriptionError

  let body
  try {
    body = await request.json()
  } catch {
    return validationError({ body: ['Invalid JSON'] })
  }

  const parsed = createAccountSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const { name, type, color, preferredCurrency } = parsed.data

  const existingAccount = await prisma.account.findFirst({
    where: {
      userId: user.userId,
      name,
      deletedAt: null,
    },
  })

  if (existingAccount) {
    return validationError({ name: ['An account with this name already exists'] })
  }

  try {
    const account = await prisma.account.create({
      data: {
        userId: user.userId,
        name,
        type,
        color: color ?? null,
        preferredCurrency: preferredCurrency ?? null,
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
    })

    return successResponse(account, 201)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return validationError({ name: ['An account with this name already exists'] })
    }
    serverLogger.error('Failed to create account', {
      action: 'POST /api/v1/accounts',
      userId: user.userId,
    }, error)
    return serverError('Unable to create account')
  }
}
