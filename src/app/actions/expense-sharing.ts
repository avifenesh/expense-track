'use server'

import { Prisma, PaymentStatus, SplitType } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { success, successVoid, generalError } from '@/lib/action-result'
import { handlePrismaError } from '@/lib/prisma-errors'
import { parseInput, toDecimalString, requireAuthUser, requireCsrfToken, requireActiveSubscription } from './shared'
import {
  shareExpenseSchema,
  markSharePaidSchema,
  cancelSharedExpenseSchema,
  declineShareSchema,
  userLookupSchema,
  sendPaymentReminderSchema,
  type ShareExpenseInput,
  type MarkSharePaidInput,
  type CancelSharedExpenseInput,
  type DeclineShareInput,
  type UserLookupInput,
  type SendPaymentReminderInput,
} from '@/schemas'
import { sendExpenseSharedEmail, sendPaymentReminderEmail } from '@/lib/email'
import { serverLogger } from '@/lib/server-logger'

/** Minimum hours between payment reminder emails to prevent spam */
const REMINDER_COOLDOWN_HOURS = 24

export async function shareExpenseAction(input: ShareExpenseInput) {
  const parsed = parseInput(shareExpenseSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  const transaction = await prisma.transaction.findUnique({
    where: { id: data.transactionId },
    include: {
      account: true,
      sharedExpense: true,
    },
  })

  if (!transaction) {
    return generalError('Transaction not found')
  }

  if (transaction.account.userId !== authUser.id) {
    return generalError('You do not have access to this transaction')
  }

  if (transaction.sharedExpense) {
    return generalError('This transaction is already shared')
  }

  const participantEmails = data.participants.map((p) => p.email.toLowerCase())

  // Prevent sharing with yourself
  if (participantEmails.includes(authUser.email.toLowerCase())) {
    return generalError('You cannot share an expense with yourself')
  }

  const participantUsers = await prisma.user.findMany({
    where: {
      email: { in: participantEmails },
    },
    select: {
      id: true,
      email: true,
      displayName: true,
    },
  })

  const foundEmails = new Set(participantUsers.map((u) => u.email.toLowerCase()))
  const missingEmails = participantEmails.filter((email) => !foundEmails.has(email))

  if (missingEmails.length > 0) {
    return {
      error: {
        participants: [`Users not found: ${missingEmails.join(', ')}`],
      },
    }
  }

  const totalAmount = Number(transaction.amount)

  if (data.splitType === SplitType.FIXED) {
    const totalShares = data.participants.reduce((sum, p) => sum + (p.shareAmount ?? 0), 0)
    if (totalShares > totalAmount) {
      return {
        error: {
          participants: [
            `Total share amounts ($${totalShares.toFixed(2)}) cannot exceed transaction total ($${totalAmount.toFixed(2)})`,
          ],
        },
      }
    }
  }

  const participantShares = calculateShares(
    data.splitType,
    totalAmount,
    data.participants,
    participantUsers.map((u) => u.email),
  )

  try {
    const sharedExpense = await prisma.$transaction(async (tx) => {
      const shared = await tx.sharedExpense.create({
        data: {
          transactionId: data.transactionId,
          ownerId: authUser.id,
          splitType: data.splitType,
          totalAmount: new Prisma.Decimal(toDecimalString(totalAmount)),
          currency: transaction.currency,
          description: data.description,
        },
      })

      const participantData = participantUsers.map((user) => {
        const share = participantShares.get(user.email.toLowerCase())
        if (!share) {
          throw new Error(`Share data not found for user ${user.email}`)
        }
        return {
          sharedExpenseId: shared.id,
          userId: user.id,
          shareAmount: new Prisma.Decimal(toDecimalString(share.amount)),
          sharePercentage: share.percentage ? new Prisma.Decimal(toDecimalString(share.percentage)) : null,
          status: PaymentStatus.PENDING,
        }
      })

      await tx.expenseParticipant.createMany({
        data: participantData,
      })

      return shared
    })

    for (const user of participantUsers) {
      const share = participantShares.get(user.email.toLowerCase())
      if (!share) continue // Skip if share not found (should not happen)
      sendExpenseSharedEmail({
        to: user.email,
        participantName: user.displayName,
        ownerName: authUser.displayName,
        amount: share.amount,
        totalAmount,
        currency: transaction.currency,
        description: data.description || transaction.description || 'Shared expense',
      }).catch((err) => {
        serverLogger.warn('Failed to send expense share email', { to: user.email, error: err })
      })
    }

    revalidatePath('/')
    return success({ sharedExpenseId: sharedExpense.id })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'shareExpense',
      userId: authUser.id,
      input: data,
      fallbackMessage: 'Unable to share expense',
    })
  }
}

export async function markSharePaidAction(input: MarkSharePaidInput) {
  const parsed = parseInput(markSharePaidSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  const participant = await prisma.expenseParticipant.findUnique({
    where: { id: data.participantId },
    include: {
      sharedExpense: true,
    },
  })

  if (!participant) {
    return generalError('Participant record not found')
  }

  // Only the owner can mark as paid
  if (participant.sharedExpense.ownerId !== authUser.id) {
    return generalError('Only the expense owner can mark payments as received')
  }

  if (participant.status === PaymentStatus.PAID) {
    return generalError('This share is already marked as paid')
  }

  if (participant.status === PaymentStatus.DECLINED) {
    return generalError('Cannot mark a declined share as paid')
  }

  try {
    await prisma.expenseParticipant.update({
      where: { id: data.participantId },
      data: {
        status: PaymentStatus.PAID,
        paidAt: new Date(),
      },
    })

    revalidatePath('/')
    return successVoid()
  } catch (error) {
    return handlePrismaError(error, {
      action: 'markSharePaid',
      userId: authUser.id,
      input: data,
      fallbackMessage: 'Unable to mark share as paid',
    })
  }
}

export async function cancelSharedExpenseAction(input: CancelSharedExpenseInput) {
  const parsed = parseInput(cancelSharedExpenseSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  const sharedExpense = await prisma.sharedExpense.findUnique({
    where: { id: data.sharedExpenseId },
  })

  if (!sharedExpense) {
    return generalError('Shared expense not found')
  }

  if (sharedExpense.ownerId !== authUser.id) {
    return generalError('Only the expense owner can cancel sharing')
  }

  try {
    await prisma.sharedExpense.delete({
      where: { id: data.sharedExpenseId },
    })

    revalidatePath('/')
    return successVoid()
  } catch (error) {
    return handlePrismaError(error, {
      action: 'cancelSharedExpense',
      userId: authUser.id,
      input: data,
      fallbackMessage: 'Unable to cancel shared expense',
    })
  }
}

export async function declineShareAction(input: DeclineShareInput) {
  const parsed = parseInput(declineShareSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  const participant = await prisma.expenseParticipant.findUnique({
    where: { id: data.participantId },
  })

  if (!participant) {
    return generalError('Participant record not found')
  }

  // Only the participant can decline their own share
  if (participant.userId !== authUser.id) {
    return generalError('You can only decline shares assigned to you')
  }

  if (participant.status !== PaymentStatus.PENDING) {
    return generalError(`Cannot decline a share that is already ${participant.status.toLowerCase()}`)
  }

  try {
    await prisma.expenseParticipant.update({
      where: { id: data.participantId },
      data: {
        status: PaymentStatus.DECLINED,
      },
    })

    revalidatePath('/')
    return successVoid()
  } catch (error) {
    return handlePrismaError(error, {
      action: 'declineShare',
      userId: authUser.id,
      input: data,
      fallbackMessage: 'Unable to decline share',
    })
  }
}

export async function getMySharedExpensesAction() {
  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  try {
    const sharedExpenses = await prisma.sharedExpense.findMany({
      where: { ownerId: authUser.id },
      include: {
        transaction: {
          include: {
            category: true,
          },
        },
        participants: {
          include: {
            participant: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return success({ sharedExpenses })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'getMySharedExpenses',
      userId: authUser.id,
      input: {},
      fallbackMessage: 'Unable to load shared expenses',
    })
  }
}

export async function getExpensesSharedWithMeAction() {
  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  try {
    const participations = await prisma.expenseParticipant.findMany({
      where: { userId: authUser.id },
      include: {
        sharedExpense: {
          include: {
            transaction: {
              include: {
                category: true,
              },
            },
            owner: {
              select: {
                id: true,
                email: true,
                displayName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return success({ participations })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'getExpensesSharedWithMe',
      userId: authUser.id,
      input: {},
      fallbackMessage: 'Unable to load shared expenses',
    })
  }
}

export async function lookupUserForSharingAction(input: UserLookupInput) {
  const parsed = parseInput(userLookupSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  const email = data.email.toLowerCase()

  if (email === authUser.email.toLowerCase()) {
    return generalError('You cannot share expenses with yourself')
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        displayName: true,
      },
    })

    if (!user) {
      return generalError('No user found with this email')
    }

    return success({ user })
  } catch (error) {
    return handlePrismaError(error, {
      action: 'lookupUserForSharing',
      userId: authUser.id,
      input: { email: data.email },
      fallbackMessage: 'Unable to look up user',
    })
  }
}

export async function sendPaymentReminderAction(input: SendPaymentReminderInput) {
  const parsed = parseInput(sendPaymentReminderSchema, input)
  if ('error' in parsed) return parsed
  const data = parsed.data

  const csrfCheck = await requireCsrfToken(data.csrfToken)
  if ('error' in csrfCheck) return csrfCheck

  const subscriptionCheck = await requireActiveSubscription()
  if ('error' in subscriptionCheck) return subscriptionCheck

  const auth = await requireAuthUser()
  if ('error' in auth) return auth
  const { authUser } = auth

  const participant = await prisma.expenseParticipant.findUnique({
    where: { id: data.participantId },
    include: {
      participant: {
        select: {
          email: true,
          displayName: true,
        },
      },
      sharedExpense: {
        include: {
          transaction: true,
        },
      },
    },
  })

  if (!participant) {
    return generalError('Participant record not found')
  }

  if (participant.sharedExpense.ownerId !== authUser.id) {
    return generalError('Only the expense owner can send reminders')
  }

  if (participant.status !== PaymentStatus.PENDING) {
    return generalError(`Cannot send reminder for a ${participant.status.toLowerCase()} share`)
  }

  if (participant.reminderSentAt) {
    const hoursSinceLastReminder = (Date.now() - participant.reminderSentAt.getTime()) / (1000 * 60 * 60)
    if (hoursSinceLastReminder < REMINDER_COOLDOWN_HOURS) {
      return generalError('You can only send one reminder per day')
    }
  }

  try {
    await sendPaymentReminderEmail({
      to: participant.participant.email,
      participantName: participant.participant.displayName,
      ownerName: authUser.displayName,
      amount: Number(participant.shareAmount),
      currency: participant.sharedExpense.currency,
      description:
        participant.sharedExpense.description || participant.sharedExpense.transaction.description || 'Shared expense',
    })

    await prisma.expenseParticipant.update({
      where: { id: data.participantId },
      data: {
        reminderSentAt: new Date(),
      },
    })

    revalidatePath('/')
    return successVoid()
  } catch (error) {
    return handlePrismaError(error, {
      action: 'sendPaymentReminder',
      userId: authUser.id,
      input: data,
      fallbackMessage: 'Unable to send reminder',
    })
  }
}

export function calculateShares(
  splitType: SplitType,
  totalAmount: number,
  participants: Array<{ email: string; shareAmount?: number; sharePercentage?: number }>,
  validEmails: string[],
): Map<string, { amount: number; percentage: number | null }> {
  const shares = new Map<string, { amount: number; percentage: number | null }>()
  const numParticipants = validEmails.length

  switch (splitType) {
    case SplitType.EQUAL: {
      const equalShare = Math.round((totalAmount / (numParticipants + 1)) * 100) / 100
      for (const email of validEmails) {
        shares.set(email.toLowerCase(), { amount: equalShare, percentage: null })
      }
      break
    }

    case SplitType.PERCENTAGE: {
      for (const p of participants) {
        const email = p.email.toLowerCase()
        if (!validEmails.some((e) => e.toLowerCase() === email)) continue

        const percentage = p.sharePercentage ?? 0
        const amount = Math.round(totalAmount * (percentage / 100) * 100) / 100
        shares.set(email, { amount, percentage })
      }
      break
    }

    case SplitType.FIXED: {
      for (const p of participants) {
        const email = p.email.toLowerCase()
        if (!validEmails.some((e) => e.toLowerCase() === email)) continue

        const amount = p.shareAmount ?? 0
        shares.set(email, { amount, percentage: null })
      }
      break
    }
  }

  return shares
}
