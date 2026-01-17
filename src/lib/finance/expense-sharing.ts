// Finance module - expense sharing operations
import { Currency, PaymentStatus, SplitType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { decimalToNumber } from './utils'
import type { SharedExpenseSummary, ExpenseParticipationSummary, SettlementBalance } from './types'

/**
 * Get expenses shared by a user with others.
 */
export async function getSharedExpenses(userId: string): Promise<SharedExpenseSummary[]> {
  const sharedExpenses = await prisma.sharedExpense.findMany({
    where: { ownerId: userId },
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

  return sharedExpenses.map((expense) => {
    const totalAmount = decimalToNumber(expense.totalAmount)
    const participants = expense.participants.map((p) => ({
      id: p.id,
      shareAmount: decimalToNumber(p.shareAmount),
      sharePercentage: p.sharePercentage ? decimalToNumber(p.sharePercentage) : null,
      status: p.status,
      paidAt: p.paidAt,
      reminderSentAt: p.reminderSentAt,
      participant: p.participant,
    }))

    const totalOwed = participants
      .filter((p) => p.status === PaymentStatus.PENDING)
      .reduce((sum, p) => sum + p.shareAmount, 0)
    const totalPaid = participants
      .filter((p) => p.status === PaymentStatus.PAID)
      .reduce((sum, p) => sum + p.shareAmount, 0)
    const allSettled = participants.every((p) => p.status !== PaymentStatus.PENDING)

    return {
      id: expense.id,
      transactionId: expense.transactionId,
      splitType: expense.splitType,
      totalAmount,
      currency: expense.currency,
      description: expense.description,
      createdAt: expense.createdAt,
      transaction: {
        id: expense.transaction.id,
        date: expense.transaction.date,
        description: expense.transaction.description,
        category: {
          id: expense.transaction.category.id,
          name: expense.transaction.category.name,
        },
      },
      participants,
      totalOwed,
      totalPaid,
      allSettled,
    }
  })
}

/**
 * Get expenses shared with a user by others.
 */
export async function getExpensesSharedWithMe(userId: string): Promise<ExpenseParticipationSummary[]> {
  const participations = await prisma.expenseParticipant.findMany({
    where: { userId },
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

  return participations.map((p) => ({
    id: p.id,
    shareAmount: decimalToNumber(p.shareAmount),
    sharePercentage: p.sharePercentage ? decimalToNumber(p.sharePercentage) : null,
    status: p.status,
    paidAt: p.paidAt,
    sharedExpense: {
      id: p.sharedExpense.id,
      splitType: p.sharedExpense.splitType,
      totalAmount: decimalToNumber(p.sharedExpense.totalAmount),
      currency: p.sharedExpense.currency,
      description: p.sharedExpense.description,
      createdAt: p.sharedExpense.createdAt,
      transaction: {
        id: p.sharedExpense.transaction.id,
        date: p.sharedExpense.transaction.date,
        description: p.sharedExpense.transaction.description,
        category: {
          id: p.sharedExpense.transaction.category.id,
          name: p.sharedExpense.transaction.category.name,
        },
      },
      owner: p.sharedExpense.owner,
    },
  }))
}

/**
 * Calculate share amounts for expense sharing based on split type.
 * Pure utility function - no database interaction.
 */
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

/**
 * Calculate settlement balances between the user and everyone they share expenses with.
 * Balances are grouped by user AND currency to avoid mixing different currencies.
 */
export async function getSettlementBalance(userId: string): Promise<SettlementBalance[]> {
  // Get what others owe the user (expenses user shared)
  const sharedByUser = await prisma.expenseParticipant.findMany({
    where: {
      sharedExpense: { ownerId: userId },
      status: PaymentStatus.PENDING,
    },
    include: {
      participant: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
      sharedExpense: {
        select: {
          currency: true,
        },
      },
    },
  })

  // Get what user owes others (expenses shared with user)
  const sharedWithUser = await prisma.expenseParticipant.findMany({
    where: {
      userId,
      status: PaymentStatus.PENDING,
    },
    include: {
      sharedExpense: {
        include: {
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
  })

  // Aggregate balances by user AND currency
  const balanceMap = new Map<string, SettlementBalance>()

  // Create composite key for user + currency
  const getKey = (otherUserId: string, currency: Currency) => `${otherUserId}:${currency}`

  // Others owe user
  for (const p of sharedByUser) {
    const currency = p.sharedExpense.currency
    const key = getKey(p.participant.id, currency)
    const existing = balanceMap.get(key) || {
      userId: p.participant.id,
      userEmail: p.participant.email,
      userDisplayName: p.participant.displayName,
      currency,
      youOwe: 0,
      theyOwe: 0,
      netBalance: 0,
    }
    existing.theyOwe += decimalToNumber(p.shareAmount)
    existing.netBalance = existing.theyOwe - existing.youOwe
    balanceMap.set(key, existing)
  }

  // User owes others
  for (const p of sharedWithUser) {
    const owner = p.sharedExpense.owner
    const currency = p.sharedExpense.currency
    const key = getKey(owner.id, currency)
    const existing = balanceMap.get(key) || {
      userId: owner.id,
      userEmail: owner.email,
      userDisplayName: owner.displayName,
      currency,
      youOwe: 0,
      theyOwe: 0,
      netBalance: 0,
    }
    existing.youOwe += decimalToNumber(p.shareAmount)
    existing.netBalance = existing.theyOwe - existing.youOwe
    balanceMap.set(key, existing)
  }

  return Array.from(balanceMap.values()).sort((a, b) => Math.abs(b.netBalance) - Math.abs(a.netBalance))
}
