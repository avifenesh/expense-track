import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { getSharedExpensesPaginated } from '@/lib/finance/expense-sharing'
import { successResponse, validationError } from '@/lib/api-helpers'
import { formatDateForApi } from '@/utils/date'
import type { SharedExpenseSummary } from '@/lib/finance/types'
import type { SharedExpenseStatusFilter } from '@/lib/finance/types'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

/**
 * Format a shared expense for API response.
 * Converts Date objects and Decimals to strings.
 */
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

/**
 * GET /api/v1/expenses/shared-by-me
 *
 * Retrieves paginated list of expenses shared by the authenticated user.
 *
 * @query status - Optional. Filter by status: "pending" | "settled" | "all" (default: "all")
 * @query limit - Optional. Number of results (default: 50, max: 100)
 * @query offset - Optional. Pagination offset (default: 0)
 *
 * @returns {Object} { expenses: SharedExpense[], total: number, hasMore: boolean }
 * @throws {400} Validation error - Invalid parameters
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {429} Rate limited - Too many requests
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (user) => {
    const { searchParams } = new URL(request.url)
    const statusParam = searchParams.get('status')
    const limitParam = searchParams.get('limit')
    const offsetParam = searchParams.get('offset')

    // Validate status parameter
    const validStatuses: SharedExpenseStatusFilter[] = ['pending', 'settled', 'all']
    let status: SharedExpenseStatusFilter = 'all'

    if (statusParam) {
      if (!validStatuses.includes(statusParam as SharedExpenseStatusFilter)) {
        return validationError({ status: ['status must be "pending", "settled", or "all"'] })
      }
      status = statusParam as SharedExpenseStatusFilter
    }

    // Parse and validate limit
    let limit = DEFAULT_LIMIT
    if (limitParam) {
      const parsed = parseInt(limitParam, 10)
      if (isNaN(parsed) || parsed < 1) {
        return validationError({ limit: ['limit must be a positive integer'] })
      }
      limit = Math.min(parsed, MAX_LIMIT)
    }

    // Parse and validate offset
    let offset = 0
    if (offsetParam) {
      const parsed = parseInt(offsetParam, 10)
      if (isNaN(parsed) || parsed < 0) {
        return validationError({ offset: ['offset must be a non-negative integer'] })
      }
      offset = parsed
    }

    // Fetch shared expenses with filtering
    const result = await getSharedExpensesPaginated(user.userId, {
      status,
      limit,
      offset,
    })

    return successResponse({
      expenses: result.items.map(formatSharedExpense),
      total: result.total,
      hasMore: result.hasMore,
    })
  })
}
