import { NextRequest } from 'next/server'
import { z } from 'zod'
import { Currency, TransactionType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { notFoundError, successResponse, validationError } from '@/lib/api-helpers'
import { withApiAuth, parseJsonBody } from '@/lib/api-middleware'
import { invalidateDashboardCache } from '@/lib/dashboard-cache'
import { getMonthStartFromKey } from '@/utils/date'
import { serverLogger } from '@/lib/server-logger'

const setBalanceApiSchema = z.object({
  targetBalance: z.number().finite(),
  currency: z.nativeEnum(Currency).default(Currency.USD),
  monthKey: z.string().min(7, 'Month key is required'),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: accountId } = await params

  return withApiAuth(
    request,
    async (user) => {
      const body = await parseJsonBody(request)
      if (body === null) {
        return validationError({ body: ['Invalid JSON'] })
      }

      const parsed = setBalanceApiSchema.safeParse(body)
      if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
      }

      const { targetBalance, currency, monthKey } = parsed.data
      const monthStart = getMonthStartFromKey(monthKey)

      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: user.userId, deletedAt: null },
      })

      if (!account) {
        return notFoundError('Account not found')
      }

      try {
        const result = await prisma.$transaction(async (tx) => {
          const adjustmentCategory = await tx.category.upsert({
            where: {
              userId_name_type: {
                userId: user.userId,
                name: 'Balance Adjustment',
                type: TransactionType.INCOME,
              },
            },
            update: {},
            create: {
              userId: user.userId,
              name: 'Balance Adjustment',
              type: TransactionType.INCOME,
            },
          })

          const [incomeAgg, expenseAgg] = await Promise.all([
            tx.transaction.aggregate({
              where: { accountId, month: monthStart, deletedAt: null, type: TransactionType.INCOME },
              _sum: { amount: true },
            }),
            tx.transaction.aggregate({
              where: { accountId, month: monthStart, deletedAt: null, type: TransactionType.EXPENSE },
              _sum: { amount: true },
            }),
          ])

          const currentIncome = incomeAgg._sum.amount ? Number(incomeAgg._sum.amount) : 0
          const currentExpense = expenseAgg._sum.amount ? Number(expenseAgg._sum.amount) : 0
          const currentNet = currentIncome - currentExpense
          const adjustment = targetBalance - currentNet

          if (Math.abs(adjustment) < 0.01) {
            return { adjustment: 0, transaction: null }
          }

          const transactionType = adjustment > 0 ? TransactionType.INCOME : TransactionType.EXPENSE
          const transactionAmount = Math.abs(adjustment)

          const transaction = await tx.transaction.create({
            data: {
              accountId,
              categoryId: adjustmentCategory.id,
              type: transactionType,
              amount: new Prisma.Decimal(transactionAmount.toFixed(2)),
              currency,
              date: new Date(),
              month: monthStart,
              description: 'Balance adjustment',
              isRecurring: false,
            },
          })

          return { adjustment, transaction, transactionType, transactionAmount }
        })

        if (result.transaction) {
          await invalidateDashboardCache({ monthKey, accountId })

          return successResponse(
            {
              adjustment: result.adjustment,
              transaction: {
                id: result.transaction.id,
                type: result.transactionType,
                amount: result.transactionAmount!.toFixed(2),
                currency,
              },
            },
            201,
          )
        }

        return successResponse({ adjustment: 0 })
      } catch (error) {
        serverLogger.error(
          'Failed to set balance',
          { action: 'POST /api/v1/accounts/[id]/set-balance', userId: user.userId, accountId },
          error,
        )
        throw error
      }
    },
    { requireSubscription: true },
  )
}
