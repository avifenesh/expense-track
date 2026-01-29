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
import { sendPaymentReminderEmail } from '@/lib/email'

const REMINDER_COOLDOWN_HOURS = 24

type RouteParams = { params: Promise<{ id: string }> }

/**
 * POST /api/v1/expenses/shares/[id]/remind
 * Send a payment reminder to a participant (owner only).
 * Note: [id] here refers to the participantId.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  return withApiAuth(
    request,
    async (user) => {
      const { id: participantId } = await params

      // 1. Get participant with related data for email
      const participant = await prisma.expenseParticipant.findFirst({
        where: {
          id: participantId,
          deletedAt: null,
          sharedExpense: { deletedAt: null },
        },
        include: {
          participant: {
            select: { email: true, displayName: true },
          },
          sharedExpense: {
            select: {
              ownerId: true,
              description: true,
              currency: true,
              owner: { select: { displayName: true } },
              transaction: { select: { description: true } },
            },
          },
        },
      })

      if (!participant) {
        return notFoundError('Participant not found')
      }

      // 2. Authorization check - only owner can send reminders
      if (participant.sharedExpense.ownerId !== user.userId) {
        return forbiddenError('Only the expense owner can send reminders')
      }

      // 3. Validate status is PENDING
      if (participant.status !== PaymentStatus.PENDING) {
        return validationError({
          status: [
            `Cannot send reminder for a ${participant.status.toLowerCase()} share`,
          ],
        })
      }

      // 4. Check 24-hour cooldown
      if (participant.reminderSentAt) {
        const hoursSinceLastReminder =
          (Date.now() - participant.reminderSentAt.getTime()) / (1000 * 60 * 60)

        if (hoursSinceLastReminder < REMINDER_COOLDOWN_HOURS) {
          return validationError({
            reminderSentAt: ['You can only send one reminder per day'],
          })
        }
      }

      // 5. Send email
      const description =
        participant.sharedExpense.description ||
        participant.sharedExpense.transaction.description ||
        'Shared expense'

      await sendPaymentReminderEmail({
        to: participant.participant.email,
        participantName: participant.participant.displayName,
        ownerName: participant.sharedExpense.owner.displayName,
        amount: Number(participant.shareAmount),
        currency: participant.sharedExpense.currency,
        description,
      })

      // 6. Update reminderSentAt timestamp
      const reminderSentAt = new Date()

      await prisma.expenseParticipant.update({
        where: { id: participantId },
        data: { reminderSentAt },
      })

      // 7. Log action
      serverLogger.info('Sent payment reminder to participant', {
        action: 'POST /api/v1/expenses/shares/[id]/remind',
        userId: user.userId,
        participantId,
      })

      // 8. Return success
      return successResponse({
        id: participantId,
        reminderSentAt: reminderSentAt.toISOString(),
      })
    },
    { requireSubscription: true }
  )
}
