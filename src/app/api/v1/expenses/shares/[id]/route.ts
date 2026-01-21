import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api-middleware'
import {
  successResponse,
  notFoundError,
  forbiddenError,
  validationError,
} from '@/lib/api-helpers'
import { PaymentStatus } from '@prisma/client'
import { serverLogger } from '@/lib/server-logger'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * DELETE /api/v1/expenses/shares/[id]
 * Cancel/delete a shared expense (owner only).
 * Cannot delete if any participant has already paid.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(
    request,
    async (user) => {
      const { id } = await params

      const sharedExpense = await prisma.sharedExpense.findFirst({
        where: {
          id,
          deletedAt: null,
        },
        include: {
          participants: {
            where: { deletedAt: null },
          },
        },
      })

      if (!sharedExpense) {
        return notFoundError('Shared expense not found')
      }

      if (sharedExpense.ownerId !== user.userId) {
        return forbiddenError('Only the expense owner can cancel a shared expense')
      }

      const paidParticipant = sharedExpense.participants.find(
        (p) => p.status === PaymentStatus.PAID
      )
      if (paidParticipant) {
        return validationError({
          participants: ['Cannot cancel expense when participants have already paid'],
        })
      }

      const now = new Date()

      await prisma.$transaction(async (tx) => {
        await tx.sharedExpense.update({
          where: { id },
          data: {
            deletedAt: now,
            deletedBy: user.userId,
          },
        })

        await tx.expenseParticipant.updateMany({
          where: { sharedExpenseId: id },
          data: {
            deletedAt: now,
            deletedBy: user.userId,
          },
        })
      })

      serverLogger.info('Deleted shared expense', {
        action: 'DELETE /api/v1/expenses/shares/[id]',
        userId: user.userId,
        sharedExpenseId: id,
        participantCount: sharedExpense.participants.length,
      })

      return successResponse({ deleted: true })
    },
    { requireSubscription: true }
  )
}
