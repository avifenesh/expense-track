import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { ensureApiAccountOwnership } from '@/lib/api-auth-helpers'
import { getCachedDashboardData } from '@/lib/dashboard-cache'
import {
  authError,
  forbiddenError,
  rateLimitError,
  serverError,
  successResponse,
  validationError,
} from '@/lib/api-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { getMonthKey, formatDateForApi } from '@/utils/date'
import { serverLogger } from '@/lib/server-logger'
import type { DashboardData, CategoryBudgetSummary } from '@/lib/finance'
import { getBudgetProgress } from '@/lib/dashboard-ux'

/**
 * GET /api/v1/dashboard
 *
 * Retrieves dashboard summary data for the mobile app.
 *
 * @query accountId - Required. The account to fetch dashboard data for.
 * @query month - Optional. Month in YYYY-MM format (defaults to current month).
 *
 * @returns {Object} Dashboard summary with:
 *   - month: string (YYYY-MM)
 *   - summary: { totalIncome, totalExpenses, netResult }
 *   - budgetProgress: [{ categoryId, categoryName, budgeted, spent, remaining, percentUsed }]
 *   - recentTransactions: [{ id, amount, description, date, category }] (5 most recent)
 *   - pendingSharedExpenses: number
 *
 * @throws {400} Validation error - Missing accountId or invalid month format
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User doesn't own the account
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to fetch dashboard data
 */
export async function GET(request: NextRequest) {
  // 1. Authenticate with JWT
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 2. Rate limit check
  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

  // 3. Parse and validate query parameters
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId')
  const monthParam = searchParams.get('month')

  // Validate required accountId
  if (accountId === null || accountId === '') {
    return validationError({ accountId: ['accountId is required'] })
  }

  // Validate month format if provided, default to current month
  let monthKey: string
  if (monthParam !== null && monthParam !== '') {
    // Validate YYYY-MM format
    if (!/^\d{4}-\d{2}$/.test(monthParam)) {
      return validationError({ month: ['month must be in YYYY-MM format'] })
    }
    monthKey = monthParam
  } else {
    monthKey = getMonthKey(new Date())
  }

  // 4. Authorize account access
  const accountCheck = await ensureApiAccountOwnership(accountId, user.userId)
  if (!accountCheck.allowed) {
    return forbiddenError('Access denied')
  }

  // 5. Get dashboard data (cached)
  try {
    const dashboardData = await getCachedDashboardData({
      monthKey,
      accountId,
      userId: user.userId,
    })

    // 6. Transform to mobile-friendly response format
    const response = transformDashboardResponse(dashboardData, monthKey)

    return successResponse(response)
  } catch (error) {
    serverLogger.error('Failed to fetch dashboard data', { action: 'GET /api/v1/dashboard' }, error)
    return serverError('Unable to fetch dashboard data')
  }
}

/**
 * Transform full DashboardData to mobile-optimized response format.
 */
function transformDashboardResponse(data: DashboardData, monthKey: string) {
  // Extract summary from stats array
  const summary = extractSummary(data)

  // Transform budget progress
  const budgetProgress = data.budgets.map((budget) => transformBudget(budget))

  // Get 5 most recent transactions
  const recentTransactions = data.transactions.slice(0, 5).map((t) => ({
    id: t.id,
    amount: t.convertedAmount.toFixed(2),
    description: t.description,
    date: formatDateForApi(t.date),
    category: {
      name: t.category.name,
      color: t.category.color,
    },
  }))

  // Count pending shared expenses (expenses shared with this user that are PENDING)
  const pendingSharedExpenses = (data.expensesSharedWithMe || []).filter(
    (p) => p.status === 'PENDING'
  ).length

  return {
    month: monthKey,
    summary,
    budgetProgress,
    recentTransactions,
    pendingSharedExpenses,
  }
}

/**
 * Extract income/expense/net from DashboardData stats array.
 */
function extractSummary(data: DashboardData) {
  // Find the "Net this month" stat which contains the breakdown
  const netStat = data.stats.find((s) => s.breakdown?.type === 'net-this-month')

  if (netStat?.breakdown?.type === 'net-this-month') {
    const breakdown = netStat.breakdown
    return {
      totalIncome: breakdown.income.toFixed(2),
      totalExpenses: breakdown.expense.toFixed(2),
      netResult: breakdown.net.toFixed(2),
    }
  }

  // Fallback: calculate from transactions if stat breakdown not available
  let totalIncome = 0
  let totalExpenses = 0

  for (const t of data.transactions) {
    if (t.type === 'INCOME') {
      totalIncome += t.convertedAmount
    } else {
      totalExpenses += Math.abs(t.convertedAmount)
    }
  }

  return {
    totalIncome: totalIncome.toFixed(2),
    totalExpenses: totalExpenses.toFixed(2),
    netResult: (totalIncome - totalExpenses).toFixed(2),
  }
}

/**
 * Transform CategoryBudgetSummary to mobile budget progress format.
 */
function transformBudget(budget: CategoryBudgetSummary) {
  const percentUsed = Math.round(getBudgetProgress(budget) * 100)

  return {
    categoryId: budget.categoryId,
    categoryName: budget.categoryName,
    budgeted: budget.planned.toFixed(2),
    spent: budget.actual.toFixed(2),
    remaining: budget.remaining.toFixed(2),
    percentUsed,
  }
}
