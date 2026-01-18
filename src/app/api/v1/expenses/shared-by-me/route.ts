import { NextRequest } from 'next/server'
import { withApiAuth } from '@/lib/api-middleware'
import { getSharedExpensesPaginated } from '@/lib/finance/expense-sharing'
import { successResponse, validationError } from '@/lib/api-helpers'
import { formatSharedExpense } from '@/app/api/v1/expenses/formatters'
import { DEFAULT_PAGINATION_LIMIT } from '@/lib/finance/types'
import type { SharedExpenseStatusFilter } from '@/lib/finance/types'

const DEFAULT_LIMIT = DEFAULT_PAGINATION_LIMIT
const MAX_LIMIT = 100

const VALID_STATUSES = ['pending', 'settled', 'all'] as const

/**
 * Type guard to check if a value is a valid SharedExpenseStatusFilter.
 */
function isSharedExpenseStatusFilter(value: unknown): value is SharedExpenseStatusFilter {
  return typeof value === 'string' && VALID_STATUSES.includes(value as SharedExpenseStatusFilter)
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

    // Validate status parameter using type guard
    let status: SharedExpenseStatusFilter = 'all'

    if (statusParam) {
      if (!isSharedExpenseStatusFilter(statusParam)) {
        return validationError({ status: ['status must be "pending", "settled", or "all"'] })
      }
      status = statusParam
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
