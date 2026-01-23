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
 * PATCH /api/v1/expenses/shares/[id]/paid
 * Mark a participant's share as paid (owner only).
 * Note: [id] here refers to the participantId.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(
    request,
    async (user) => {
      const { id: participantId } = await params

      // 1. Get participant
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

      // 2. Authorization check
      if (participant.sharedExpense.ownerId !== user.userId) {
        return forbiddenError(
          'Only the expense owner can mark payments as received'
        )
      }

      // 3. Update status atomically
      const paidAt = new Date()

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

      if (updateResult.count === 0) {
        return validationError({
          status: [
            `Cannot mark a share as paid that is already ${participant.status.toLowerCase()}`,
          ],
        })
      }

      serverLogger.info('Marked participant share as paid', {
        action: 'PATCH /api/v1/expenses/shares/[id]/paid',
        userId: user.userId,
        participantId,
      })

      // 4. Return success
      return successResponse({
        id: participantId,
        status: PaymentStatus.PAID,
        paidAt: paidAt.toISOString(),
      })
    },
    { requireSubscription: true }
  )
}
