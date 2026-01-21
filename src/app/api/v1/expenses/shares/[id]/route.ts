import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withApiAuth } from '@/lib/api-middleware'
import {
  successResponse,
  notFoundError,
  forbiddenError,
  validationError,
  serverError,
} from '@/lib/api-helpers'
import { PaymentStatus } from '@prisma/client'
import { serverLogger } from '@/lib/server-logger'

type RouteParams = { params: Promise<{ id: string }> }

/**
 * DELETE /api/v1/expenses/shares/[id]
 * Delete a shared expense (owner only, cannot delete if any participant paid).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(
    request,
    async (user) => {
      const { id } = await params

      // 1. Get shared expense
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

      // 2. Authorization check
      if (sharedExpense.ownerId !== user.userId) {
        return forbiddenError('Only the expense owner can delete a shared expense')
      }

      // 3. Validate state
      const paidParticipant = sharedExpense.participants.find(
        (p) => p.status === PaymentStatus.PAID
      )
      if (paidParticipant) {
        return validationError({
          participants: ['Cannot delete expense when participants have already paid'],
        })
      }

      // 4. Soft delete in transaction
      const now = new Date()

      try {
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
      } catch (error) {
        serverLogger.error('Failed to delete shared expense', {
          action: 'DELETE /api/v1/expenses/shares/[id]',
          userId: user.userId,
          sharedExpenseId: id,
          participantCount: sharedExpense.participants.length,
        }, error)
        return serverError('Failed to delete shared expense. Please try again.')
      }

      serverLogger.info('Deleted shared expense', {
        action: 'DELETE /api/v1/expenses/shares/[id]',
        userId: user.userId,
        sharedExpenseId: id,
        participantCount: sharedExpense.participants.length,
      })

      // 5. Return success
      return successResponse({ deleted: true })
    },
    { requireSubscription: true }
  )
}
