import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { PaymentStatus } from '@prisma/client'
import { successResponse, notFoundError, forbiddenError } from '@/lib/api-helpers'
import { serverLogger } from '@/lib/server-logger'

interface RouteParams {
  params: Promise<{
    participantId: string
  }>
}

/**
 * PATCH /api/v1/sharing/[participantId]/paid
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
            select: {
              ownerId: true,
            },
          },
        },
      })

      if (!participant) {
        return notFoundError('Participant not found')
      }

      if (participant.sharedExpense.ownerId !== user.userId) {
        return forbiddenError('Only the expense owner can mark payments as received')
      }

      const now = new Date()
      const updated = await prisma.expenseParticipant.update({
        where: { id: participantId },
        data: {
          status: PaymentStatus.PAID,
          paidAt: now,
        },
      })

      serverLogger.info('Marked participant share as paid', {
        action: 'PATCH /api/v1/sharing/[participantId]/paid',
        userId: user.userId,
        participantId,
      })

      return successResponse({
        id: updated.id,
        status: updated.status,
        paidAt: updated.paidAt?.toISOString() ?? null,
      })
    },
    { requireSubscription: true },
  )
}
