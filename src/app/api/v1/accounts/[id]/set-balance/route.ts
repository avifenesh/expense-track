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

const setBalanceApiSchema = z.object({
  targetBalance: z.coerce.number(),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  monthKey: z.string().min(7, 'Month key is required'),
})

function toDecimalString(value: number): string {
  return value.toFixed(2)
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: accountId } = await params

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

  const parsed = setBalanceApiSchema.safeParse(body)
  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const { targetBalance, currency, monthKey } = parsed.data

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

  const monthStart = getMonthStartFromKey(monthKey)

  try {
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

    if (Math.abs(adjustment) < 0.01) {
      return successResponse({ adjustment: 0 })
    }

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
