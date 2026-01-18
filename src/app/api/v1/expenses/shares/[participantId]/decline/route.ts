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

interface DeclineRequestBody {
  reason?: string
}

/**
 * POST /api/v1/expenses/shares/[participantId]/decline
 * Decline a shared expense (participant only).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(
    request,
    async (user) => {
      const { participantId } = await params

      let reason: string | undefined
      try {
        const body = await request.json() as DeclineRequestBody
        if (body.reason !== undefined) {
          if (typeof body.reason !== 'string') {
            return validationError({
              reason: ['Reason must be a string'],
            })
          }
          reason = body.reason.trim() || undefined
        }
      } catch {
        // Body is optional - empty body or missing Content-Type is expected and acceptable.
        // No logging needed for expected behavior.
      }

      const participant = await prisma.expenseParticipant.findUnique({
        where: { id: participantId },
      })

      if (!participant) {
        return notFoundError('Participant not found')
      }

      if (participant.userId !== user.userId) {
        return forbiddenError('You can only decline shares assigned to you')
      }

      if (participant.status !== PaymentStatus.PENDING) {
        return validationError({
          status: [`Cannot decline a share that is already ${participant.status.toLowerCase()}`],
        })
      }

      const declinedAt = new Date()

      await prisma.expenseParticipant.update({
        where: { id: participantId },
        data: {
          status: PaymentStatus.DECLINED,
          declinedAt,
          declineReason: reason,
        },
      })

      serverLogger.info('Participant declined shared expense', {
        action: 'POST /api/v1/expenses/shares/[participantId]/decline',
        userId: user.userId,
        participantId,
        reason: reason ?? null,
      })

      return successResponse({
        id: participantId,
        status: 'DECLINED',
        declinedAt: declinedAt.toISOString(),
      })
    },
    { requireSubscription: true },
  )
}
