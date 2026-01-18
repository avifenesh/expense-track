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

      const participant = await prisma.expenseParticipant.findUnique({
        where: { id: participantId },
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

      if (participant.status !== PaymentStatus.PENDING) {
        return validationError({
          status: [
            `Cannot mark a share as paid that is already ${participant.status.toLowerCase()}`,
          ],
        })
      }

      const paidAt = new Date()
      const updated = await prisma.expenseParticipant.update({
        where: { id: participantId },
        data: {
          status: PaymentStatus.PAID,
          paidAt,
        },
      })

      serverLogger.info('Marked participant share as paid', {
        action: 'PATCH /api/v1/expenses/shares/[participantId]/paid',
        userId: user.userId,
        participantId,
      })

      return successResponse({
        id: updated.id,
        status: updated.status,
        paidAt: updated.paidAt?.toISOString() ?? null,
      })
    },
    { requireSubscription: true }
  )
}
