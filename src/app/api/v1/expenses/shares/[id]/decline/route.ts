import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { prisma } from '@/lib/prisma'
import { PaymentStatus } from '@prisma/client'
import { successResponse, notFoundError, forbiddenError, validationError } from '@/lib/api-helpers'
import { serverLogger } from '@/lib/server-logger'

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

interface DeclineRequestBody {
  reason?: string
}

/**
 * POST /api/v1/expenses/shares/[id]/decline
 * Decline a shared expense (participant only).
 * Note: [id] here refers to the participantId.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(
    request,
    async (user) => {
      const { id: participantId } = await params

      // 1. Parse optional reason
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
        // Empty body is acceptable
      }

      // 2. Get participant
      const participant = await prisma.expenseParticipant.findFirst({
        where: { id: participantId, deletedAt: null, sharedExpense: { deletedAt: null } },
      })

      if (!participant) {
        return notFoundError('Participant not found')
      }

      // 3. Authorization check
      if (participant.userId !== user.userId) {
        return forbiddenError('You can only decline shares assigned to you')
      }

      // 4. Validate state
      if (participant.status !== PaymentStatus.PENDING) {
        return validationError({
          status: ['Cannot decline a share that is already ' + participant.status.toLowerCase()],
        })
      }

      // 5. Update status
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
        action: 'POST /api/v1/expenses/shares/[id]/decline',
        userId: user.userId,
        participantId,
        reason: reason ?? null,
      })

      // 6. Return success
      return successResponse({
        id: participantId,
        status: 'DECLINED',
        declinedAt: declinedAt.toISOString(),
      })
    },
    { requireSubscription: true },
  )
}
