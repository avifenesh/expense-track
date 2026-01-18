import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { PaymentStatus } from '@prisma/client'
import { successResponse, notFoundError, forbiddenError, validationError } from '@/lib/api-helpers'
import { serverLogger } from '@/lib/server-logger'

interface RouteParams {
  params: Promise<{
    participantId: string
  }>
}

/**
 * POST /api/v1/expenses/shares/[participantId]/decline
 * Decline a shared expense (participant only).
 *
 * Authorization: Only the participant (assignee) can decline their own share.
 * Status validation: Share must be PENDING (cannot decline PAID or already DECLINED).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

      // Authorization: Only the participant can decline their own share
      if (participant.userId !== user.userId) {
        return forbiddenError('You can only decline shares assigned to you')
      }

      // Status validation: Must be PENDING
      if (participant.status !== PaymentStatus.PENDING) {
        return validationError({
          status: [`Cannot decline a share that is already ${participant.status.toLowerCase()}`],
        })
      }

      await prisma.expenseParticipant.update({
        where: { id: participantId },
        data: {
          status: PaymentStatus.DECLINED,
        },
      })

      serverLogger.info('Participant declined shared expense', {
        action: 'POST /api/v1/expenses/shares/[participantId]/decline',
        userId: user.userId,
        participantId,
      })

      return successResponse({
        id: participantId,
        status: 'DECLINED',
      })
    },
    { requireSubscription: true },
  )
}
