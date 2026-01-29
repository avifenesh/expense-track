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
      const participant = await prisma.expenseParticipant.findUnique({
        where: {
          id: participantId,
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
              deletedAt: true,
              owner: { select: { displayName: true } },
              transaction: { select: { description: true } },
            },
          },
        },
      })

      // Check if participant exists and is not soft-deleted
      if (
        !participant ||
        participant.deletedAt !== null ||
        participant.sharedExpense.deletedAt !== null
      ) {
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

      // 5. Store previous reminderSentAt for potential rollback
      const previousReminderSentAt = participant.reminderSentAt

      // 6. Update reminderSentAt atomically with conditional check
      // This prevents race conditions: only update if cooldown has expired
      const cooldownThreshold = new Date(
        Date.now() - REMINDER_COOLDOWN_HOURS * 60 * 60 * 1000
      )

      const updateResult = await prisma.expenseParticipant.updateMany({
        where: {
          id: participantId,
          OR: [
            { reminderSentAt: null },
            { reminderSentAt: { lt: cooldownThreshold } },
          ],
        },
        data: { reminderSentAt: new Date() },
      })

      // If no rows updated, another request beat us to it
      if (updateResult.count === 0) {
        return validationError({
          reminderSentAt: ['You can only send one reminder per day'],
        })
      }

      // Get the updated timestamp
      const updated = await prisma.expenseParticipant.findUnique({
        where: { id: participantId },
        select: { reminderSentAt: true },
      })
      const reminderSentAt = updated!.reminderSentAt!

      // 7. Send email and check result
      const description =
        participant.sharedExpense.description ||
        participant.sharedExpense.transaction.description ||
        'Shared expense'

      const emailResult = await sendPaymentReminderEmail({
        to: participant.participant.email,
        participantName: participant.participant.displayName,
        ownerName: participant.sharedExpense.owner.displayName,
        amount: Number(participant.shareAmount),
        currency: participant.sharedExpense.currency,
        description,
      })

      // If email fails, rollback the timestamp to allow retry
      if (!emailResult.success) {
        await prisma.expenseParticipant.update({
          where: { id: participantId },
          data: { reminderSentAt: previousReminderSentAt },
        })

        serverLogger.error('Failed to send payment reminder email', {
          action: 'POST /api/v1/expenses/shares/[id]/remind',
          userId: user.userId,
          participantId,
        })
        return serverError('Failed to send reminder email')
      }

      // 8. Log action
      serverLogger.info('Sent payment reminder to participant', {
        action: 'POST /api/v1/expenses/shares/[id]/remind',
        userId: user.userId,
        participantId,
      })

      // 9. Return success
      return successResponse({
        id: participantId,
        reminderSentAt: reminderSentAt.toISOString(),
      })
    },
    { requireSubscription: true }
  )
}
