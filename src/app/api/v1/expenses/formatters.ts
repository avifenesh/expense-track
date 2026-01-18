/**
 * Shared formatters for expense-related API responses.
 * Converts domain types to API-safe JSON with string representations
 * for Date and number fields.
 */
import { formatDateForApi } from '@/utils/date'
import type { SharedExpenseSummary, ExpenseParticipationSummary, SettlementBalance } from '@/lib/finance/types'

/**
 * Format a SharedExpenseSummary for API response.
 * Converts Date objects and numbers to strings.
 */
export function formatSharedExpense(expense: SharedExpenseSummary) {
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

/**
 * Format an ExpenseParticipationSummary for API response.
 * Converts Date objects and numbers to strings.
 */
export function formatParticipation(participation: ExpenseParticipationSummary) {
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

/**
 * Format a SettlementBalance for API response.
 * Converts numbers to strings.
 */
export function formatSettlementBalance(balance: SettlementBalance) {
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
