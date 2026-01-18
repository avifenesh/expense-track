import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { getSharedExpenses, getExpensesSharedWithMe, getSettlementBalance } from '@/lib/finance/expense-sharing'
import { successResponse } from '@/lib/api-helpers'
import { formatSharedExpense, formatParticipation, formatSettlementBalance } from '@/app/api/v1/expenses/formatters'

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
 */
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
