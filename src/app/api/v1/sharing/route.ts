import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { getSharedExpenses, getExpensesSharedWithMe, getSettlementBalance } from '@/lib/finance/expense-sharing'
import { successResponse } from '@/lib/api-helpers'
import { formatDateForApi } from '@/utils/date'
import type { SharedExpenseSummary, ExpenseParticipationSummary, SettlementBalance } from '@/lib/finance/types'

function formatSharedExpense(expense: SharedExpenseSummary) {
  return {
    id: expense.id,
    transactionId: expense.transactionId,
    splitType: expense.splitType,
    totalAmount: expense.totalAmount.toString(),
    currency: expense.currency,
    description: expense.description,
    createdAt: expense.createdAt.toISOString(),
    transaction: {
      id: expense.transaction.id,
      date: formatDateForApi(expense.transaction.date),
      description: expense.transaction.description,
      category: {
        id: expense.transaction.category.id,
        name: expense.transaction.category.name,
      },
    },
    participants: expense.participants.map((p) => ({
      id: p.id,
      shareAmount: p.shareAmount.toString(),
      sharePercentage: p.sharePercentage?.toString() ?? null,
      status: p.status,
      paidAt: p.paidAt?.toISOString() ?? null,
      reminderSentAt: p.reminderSentAt?.toISOString() ?? null,
      participant: {
        id: p.participant.id,
        email: p.participant.email,
        displayName: p.participant.displayName,
      },
    })),
    totalOwed: expense.totalOwed.toString(),
    totalPaid: expense.totalPaid.toString(),
    allSettled: expense.allSettled,
  }
}


function formatParticipation(participation: ExpenseParticipationSummary) {
  return {
    id: participation.id,
    shareAmount: participation.shareAmount.toString(),
    sharePercentage: participation.sharePercentage?.toString() ?? null,
    status: participation.status,
    paidAt: participation.paidAt?.toISOString() ?? null,
    sharedExpense: {
      id: participation.sharedExpense.id,
      splitType: participation.sharedExpense.splitType,
      totalAmount: participation.sharedExpense.totalAmount.toString(),
      currency: participation.sharedExpense.currency,
      description: participation.sharedExpense.description,
      createdAt: participation.sharedExpense.createdAt.toISOString(),
      transaction: {
        id: participation.sharedExpense.transaction.id,
        date: formatDateForApi(participation.sharedExpense.transaction.date),
        description: participation.sharedExpense.transaction.description,
        category: {
          id: participation.sharedExpense.transaction.category.id,
          name: participation.sharedExpense.transaction.category.name,
        },
      },
      owner: {
        id: participation.sharedExpense.owner.id,
        email: participation.sharedExpense.owner.email,
        displayName: participation.sharedExpense.owner.displayName,
      },
    },
  }
}


function formatSettlementBalance(balance: SettlementBalance) {
  return {
    userId: balance.userId,
    userEmail: balance.userEmail,
    userDisplayName: balance.userDisplayName,
    currency: balance.currency,
    youOwe: balance.youOwe.toString(),
    theyOwe: balance.theyOwe.toString(),
    netBalance: balance.netBalance.toString(),
  }
}

/**
 * GET /api/v1/sharing
 *
 * Retrieves all sharing data for the authenticated user:
 * - Expenses they have shared with others
 * - Expenses shared with them by others
 * - Settlement balances with each person they share with
 *
 * @returns {Object} { sharedExpenses, expensesSharedWithMe, settlementBalances }
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {429} Rate limited - Too many requests

export async function GET(request: NextRequest) {
  return withApiAuth(request, async (user) => {
    const [sharedExpensesResult, sharedWithMeResult, balances] = await Promise.all([
      getSharedExpenses(user.userId),
      getExpensesSharedWithMe(user.userId),
      getSettlementBalance(user.userId),
    ])

    return successResponse({
      sharedExpenses: sharedExpensesResult.items.map(formatSharedExpense),
      expensesSharedWithMe: sharedWithMeResult.items.map(formatParticipation),
      settlementBalances: balances.map(formatSettlementBalance),
    })
  })
}
