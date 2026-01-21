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

type RouteParams = { params: Promise<{ participantId: string }> }

/**
 * PATCH /api/v1/expenses/shares/[participantId]/paid
 * Mark a participant's share as paid (owner only).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(
    request,
    async (user) => {
      const { participantId } = await params

      const participant = await prisma.expenseParticipant.findFirst({
        where: { id: participantId, deletedAt: null, sharedExpense: { deletedAt: null } },
        include: {
          sharedExpense: {
            select: { ownerId: true },
          },
        },
      })

      if (!participant) {
        return notFoundError('Participant not found')
      }

      if (participant.sharedExpense.ownerId !== user.userId) {
        return forbiddenError(
          'Only the expense owner can mark payments as received'
        )
      }

      const paidAt = new Date()

      // Use updateMany with status condition for atomic check-and-update
      const updateResult = await prisma.expenseParticipant.updateMany({
        where: {
          id: participantId,
          status: PaymentStatus.PENDING,
        },
        data: {
          status: PaymentStatus.PAID,
          paidAt,
        },
      })

      // If no rows updated, share was not in PENDING status
      if (updateResult.count === 0) {
        return validationError({
          status: [
            `Cannot mark a share as paid that is already ${participant.status.toLowerCase()}`,
          ],
        })
      }

      serverLogger.info('Marked participant share as paid', {
        action: 'PATCH /api/v1/expenses/shares/[participantId]/paid',
        userId: user.userId,
        participantId,
      })

      return successResponse({
        id: participantId,
        status: PaymentStatus.PAID,
        paidAt: paidAt.toISOString(),
      })
    },
    { requireSubscription: true }
  )
}
