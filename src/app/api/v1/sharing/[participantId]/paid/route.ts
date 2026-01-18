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
 *
 * Marks a participant's share as paid. Only the expense owner can mark
 * participants as paid (they are the one collecting payment).
 *
 * @param participantId - The expense participant record ID
 *
 * @returns {Object} { id, status, paidAt }
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User is not the expense owner
 * @throws {404} Not found - Participant record not found
 * @throws {429} Rate limited - Too many requests
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(
    request,
    async (user) => {
      const { participantId } = await params

      // Find the participant record with its shared expense
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

      // Verify the current user is the expense owner
      if (participant.sharedExpense.ownerId !== user.userId) {
        return forbiddenError('Only the expense owner can mark payments as received')
      }

      // Update the participant status to PAID
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
