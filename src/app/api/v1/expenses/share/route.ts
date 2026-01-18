import { NextRequest } from 'next/server'
import { Prisma, PaymentStatus, SplitType, TransactionType } from '@prisma/client'
import { withApiAuth, parseJsonBody } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { shareExpenseApiSchema } from '@/schemas/api'
import { calculateShares } from '@/lib/finance'
import {
  successResponse,
  validationError,
  forbiddenError,
  notFoundError,
  errorResponse,
} from '@/lib/api-helpers'
import { sendExpenseSharedEmail } from '@/lib/email'
import { serverLogger } from '@/lib/server-logger'

/**
 * Helper to convert number to Decimal string for Prisma.
 * Rounds to 2 decimal places.
 */
function toDecimalString(value: number): string {
  return value.toFixed(2)
}

/**
 * POST /api/v1/expenses/share
 * Create a shared expense from an existing transaction.
 *
 * Splits the transaction amount with participants using EQUAL, PERCENTAGE, or FIXED split types.
 * Sends email notifications to all participants (fire-and-forget).
 */
export async function POST(request: NextRequest) {
  return withApiAuth(
    request,
    async (user) => {
      // 1. Parse and validate request body
      const body = await parseJsonBody(request)
      if (body === null) {
        return validationError({ body: ['Invalid JSON'] })
      }

      const parsed = shareExpenseApiSchema.safeParse(body)
      if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
      }

      const data = parsed.data

      // Additional validation: PERCENTAGE splits require sharePercentage for each participant
      if (
        data.splitType === SplitType.PERCENTAGE &&
        data.participants.some((p) => p.sharePercentage == null)
      ) {
        return validationError({
          participants: ['Each participant must have a sharePercentage for PERCENTAGE splits'],
        })
      }

      // 2. Fetch transaction and verify ownership
      const transaction = await prisma.transaction.findFirst({
        where: { id: data.transactionId, deletedAt: null },
        include: {
          account: {
            select: {
              userId: true,
              user: { select: { displayName: true } },
            },
          },
          sharedExpense: { select: { id: true } },
        },
      })

      if (!transaction) {
        return notFoundError('Transaction not found')
      }

      if (transaction.account.userId !== user.userId) {
        return forbiddenError('You do not have access to this transaction')
      }

      // 3. Verify transaction is an expense (not income)
      if (transaction.type !== TransactionType.EXPENSE) {
        return validationError({
          transactionId: ['Only expense transactions can be shared'],
        })
      }

      // 4. Check if transaction is already shared
      if (transaction.sharedExpense) {
        return errorResponse('This transaction is already shared', 409)
      }

      // 5. Validate participants
      const participantEmails = data.participants.map((p) => p.email.toLowerCase())

      // Prevent sharing with yourself
      if (participantEmails.includes(user.email.toLowerCase())) {
        return validationError({
          participants: ['Expenses can only be shared with others'],
        })
      }

      // Prevent duplicate participant emails
      const uniqueEmails = new Set(participantEmails)
      if (uniqueEmails.size !== participantEmails.length) {
        return validationError({
          participants: ['Duplicate participant emails are not allowed'],
        })
      }

      // 6. Look up participant users
      const participantUsers = await prisma.user.findMany({
        where: { email: { in: participantEmails } },
        select: { id: true, email: true, displayName: true },
      })

      const foundEmails = new Set(participantUsers.map((u) => u.email.toLowerCase()))
      const missingEmails = participantEmails.filter((email) => !foundEmails.has(email))

      if (missingEmails.length > 0) {
        return validationError({
          participants: [`Users not found: ${missingEmails.join(', ')}`],
        })
      }

      // 7. Validate FIXED split amounts
      const totalAmount = Number(transaction.amount)

      if (data.splitType === SplitType.FIXED) {
        const totalShares = data.participants.reduce((sum, p) => sum + (p.shareAmount ?? 0), 0)
        if (totalShares > totalAmount) {
          return validationError({
            participants: [
              `Total share amounts ($${totalShares.toFixed(2)}) cannot exceed transaction total ($${totalAmount.toFixed(2)})`,
            ],
          })
        }
      }

      // 8. Calculate shares
      const participantShares = calculateShares(
        data.splitType,
        totalAmount,
        data.participants,
        participantUsers.map((u) => u.email),
      )

      // 9. Create SharedExpense and ExpenseParticipants atomically
      let sharedExpense
      try {
        sharedExpense = await prisma.$transaction(async (tx) => {
          const shared = await tx.sharedExpense.create({
            data: {
              transactionId: data.transactionId,
              ownerId: user.userId,
              splitType: data.splitType,
              totalAmount: new Prisma.Decimal(toDecimalString(totalAmount)),
              currency: transaction.currency,
              description: data.description,
            },
          })

          const participantData = participantUsers.map((pUser) => {
            const share = participantShares.get(pUser.email.toLowerCase())
            if (!share) {
              throw new Error(`Share data not found for user ${pUser.email}`)
            }
            return {
              sharedExpenseId: shared.id,
              userId: pUser.id,
              shareAmount: new Prisma.Decimal(toDecimalString(share.amount)),
              sharePercentage: share.percentage
                ? new Prisma.Decimal(toDecimalString(share.percentage))
                : null,
              status: PaymentStatus.PENDING,
            }
          })

          await tx.expenseParticipant.createMany({
            data: participantData,
          })

          // Fetch the created participants to return in response
          const participants = await tx.expenseParticipant.findMany({
            where: { sharedExpenseId: shared.id },
            include: {
              participant: {
                select: { id: true, email: true, displayName: true },
              },
            },
          })

          return { shared, participants }
        })
      } catch (error) {
        // Handle unique constraint violation (transaction already shared - concurrent request)
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          return errorResponse('This transaction is already shared', 409)
        }
        throw error
      }

      // 10. Send email notifications (fire-and-forget)
      for (const pUser of participantUsers) {
        const share = participantShares.get(pUser.email.toLowerCase())
        if (!share) continue

        sendExpenseSharedEmail({
          to: pUser.email,
          participantName: pUser.displayName,
          ownerName: transaction.account.user.displayName ?? user.email,
          amount: share.amount,
          totalAmount,
          currency: transaction.currency,
          description: data.description || transaction.description || 'Shared expense',
        }).catch((err) => {
          serverLogger.warn('Failed to send expense share email', {
            to: pUser.email,
            sharedExpenseId: sharedExpense.shared.id,
            error: err instanceof Error ? err.message : String(err),
          })
        })
      }

      serverLogger.info('Created shared expense', {
        action: 'POST /api/v1/expenses/share',
        userId: user.userId,
        sharedExpenseId: sharedExpense.shared.id,
        participantCount: participantUsers.length,
        splitType: data.splitType,
      })

      // 11. Return response
      return successResponse(
        {
          id: sharedExpense.shared.id,
          transactionId: sharedExpense.shared.transactionId,
          splitType: sharedExpense.shared.splitType,
          totalAmount: Number(sharedExpense.shared.totalAmount).toFixed(2),
          currency: sharedExpense.shared.currency,
          description: sharedExpense.shared.description,
          createdAt: sharedExpense.shared.createdAt.toISOString(),
          participants: sharedExpense.participants.map((p) => ({
            id: p.id,
            userId: p.participant.id,
            email: p.participant.email,
            displayName: p.participant.displayName,
            shareAmount: Number(p.shareAmount).toFixed(2),
            sharePercentage: p.sharePercentage
              ? Number(p.sharePercentage).toFixed(2)
              : null,
            status: p.status,
          })),
        },
        201,
      )
    },
    { requireSubscription: true },
  )
}
