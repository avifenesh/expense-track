import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Currency, TransactionType, Prisma } from '@prisma/client'
import { requireJwtAuth } from '@/lib/api-auth'
import { prisma } from '@/lib/prisma'
import {
  authError,
  notFoundError,
  serverError,
  successResponse,
  validationError,
  rateLimitError,
  checkSubscription,
} from '@/lib/api-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { getMonthStartFromKey } from '@/utils/date'
import { serverLogger } from '@/lib/server-logger'

// API schema - omit csrfToken since API uses JWT auth
const setBalanceApiSchema = z.object({
  targetBalance: z.coerce.number(),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  monthKey: z.string().min(7, 'Month key is required'),
})

/**
 * Helper to convert a number to a 2-decimal string for Prisma.Decimal
 */
function toDecimalString(value: number): string {
  return value.toFixed(2)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: accountId } = await params

  // 1. JWT authentication
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

  // 3. Subscription check
  const subscriptionError = await checkSubscription(user.userId)
  if (subscriptionError) return subscriptionError

  // 4. Parse and validate request body
  let body
  try {
    body = await request.json()
  } catch {
    return validationError({ body: ['Invalid JSON'] })
  }

  const parsed = setBalanceApiSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const { targetBalance, currency, monthKey } = parsed.data

  // 5. Verify account ownership
  const account = await prisma.account.findFirst({
    where: {
      id: accountId,
      userId: user.userId,
      deletedAt: null,
    },
  })

  if (!account) {
    return notFoundError('Account not found')
  }

  // 6. Business logic
  const monthStart = getMonthStartFromKey(monthKey)

  try {
    // Find or create "Balance Adjustment" category for this user
    let adjustmentCategory = await prisma.category.findFirst({
      where: { name: 'Balance Adjustment', userId: user.userId },
    })

    if (!adjustmentCategory) {
      adjustmentCategory = await prisma.category.create({
        data: {
          userId: user.userId,
          name: 'Balance Adjustment',
          type: TransactionType.INCOME,
        },
      })
    }

    // Calculate current net for this account in the specified month
    const transactions = await prisma.transaction.findMany({
      where: {
        accountId,
        month: monthStart,
        deletedAt: null,
      },
      select: {
        type: true,
        amount: true,
      },
    })

    let currentIncome = 0
    let currentExpense = 0

    for (const t of transactions) {
      const amount = typeof t.amount === 'object' ? Number(t.amount) : t.amount
      if (t.type === TransactionType.INCOME) {
        currentIncome += amount
      } else {
        currentExpense += amount
      }
    }

    const currentNet = currentIncome - currentExpense
    const adjustment = targetBalance - currentNet

    // If no adjustment needed, return early
    if (Math.abs(adjustment) < 0.01) {
      return successResponse({ adjustment: 0 })
    }

    // Create adjustment transaction
    const transactionType = adjustment > 0 ? TransactionType.INCOME : TransactionType.EXPENSE
    const transactionAmount = Math.abs(adjustment)

    const transaction = await prisma.transaction.create({
      data: {
        accountId,
        categoryId: adjustmentCategory.id,
        type: transactionType,
        amount: new Prisma.Decimal(toDecimalString(transactionAmount)),
        currency,
        date: new Date(),
        month: monthStart,
        description: 'Balance adjustment',
        isRecurring: false,
      },
    })

    // Invalidate dashboard cache for affected month/account
    await invalidateDashboardCache({
      monthKey,
      accountId,
    })

    return successResponse(
      {
        adjustment,
        transaction: {
          id: transaction.id,
          type: transactionType,
          amount: transactionAmount.toFixed(2),
          currency,
        },
      },
      201,
    )
  } catch (error) {
    serverLogger.error('Failed to set balance', {
      action: 'POST /api/v1/accounts/[id]/set-balance',
      userId: user.userId,
      accountId,
      input: { targetBalance, currency, monthKey },
    }, error)
    return serverError('Unable to set balance')
  }
}
