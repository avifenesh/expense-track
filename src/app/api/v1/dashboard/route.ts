import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { ensureResourceOwnership } from '@/lib/api-auth-helpers'
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
import { getMonthKey, getMonthStartFromKey, formatDateForApi } from '@/utils/date'
import { serverLogger } from '@/lib/server-logger'
import { getBudgetProgress } from '@/lib/dashboard-ux'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/v1/dashboard
 *
 * Retrieves dashboard summary data for the mobile app.
 *
 * @query accountId - Required. The account to fetch dashboard data for.
 * @query month - Optional. Month in YYYY-MM format (defaults to current month).
 *
 * @returns {Object} Dashboard summary with month, summary, budgetProgress, recentTransactions, pendingSharedExpenses
 * @throws {400} Validation error - Missing accountId or invalid month format
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User doesn't own the account
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to fetch dashboard data
 */
export async function GET(request: NextRequest) {
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId')
  const monthParam = searchParams.get('month')

  if (accountId === null || accountId === '') {
    return validationError({ accountId: ['accountId is required'] })
  }

  let monthKey: string
  if (monthParam !== null && monthParam !== '') {
    // Validate YYYY-MM format
    if (!/^\d{4}-\d{2}$/.test(monthParam)) {
      return validationError({ month: ['month must be in YYYY-MM format'] })
    }
    // Validate it produces a valid date
    const parsed = getMonthStartFromKey(monthParam)
    if (isNaN(parsed.getTime())) {
      return validationError({ month: ['month must be in YYYY-MM format'] })
    }
    monthKey = monthParam
  } else {
    monthKey = getMonthKey(new Date())
  }

  const accountCheck = await ensureResourceOwnership(
    () =>
      prisma.account.findFirst({
        where: { id: accountId, userId: user.userId, deletedAt: null },
        select: { id: true, preferredCurrency: true },
      }),
    'Account'
  )
  if (!accountCheck.allowed) {
    return forbiddenError('Access denied')
  }

  try {
    const dashboardData = await getCachedDashboardData({
      monthKey,
      accountId,
      userId: user.userId,
      preferredCurrency: accountCheck.resource.preferredCurrency,
    })

    const netStat = dashboardData.stats.find((s) => s.breakdown?.type === 'net-this-month')
    let summary
    if (netStat?.breakdown?.type === 'net-this-month') {
      const breakdown = netStat.breakdown
      summary = {
        totalIncome: breakdown.income.toFixed(2),
        totalExpenses: breakdown.expense.toFixed(2),
        netResult: breakdown.net.toFixed(2),
      }
    } else {
      let totalIncome = 0
      let totalExpenses = 0
      for (const t of dashboardData.transactions) {
        if (t.type === 'INCOME') {
          totalIncome += t.convertedAmount
        } else {
          totalExpenses += Math.abs(t.convertedAmount)
        }
      }
      summary = {
        totalIncome: totalIncome.toFixed(2),
        totalExpenses: totalExpenses.toFixed(2),
        netResult: (totalIncome - totalExpenses).toFixed(2),
      }
    }

    const budgetProgress = dashboardData.budgets.map((budget) => ({
      categoryId: budget.categoryId,
      categoryName: budget.categoryName,
      budgeted: budget.planned.toFixed(2),
      spent: budget.actual.toFixed(2),
      remaining: budget.remaining.toFixed(2),
      percentUsed: Math.round(getBudgetProgress(budget) * 100),
    }))

    const recentTransactions = dashboardData.transactions
      .filter((t) => t.category != null)
      .slice(0, 5)
      .map((t) => ({
        id: t.id,
        amount: t.convertedAmount.toFixed(2),
        description: t.description,
        date: formatDateForApi(t.date),
        category: {
          name: t.category.name,
          color: t.category.color,
        },
      }))

    const pendingSharedExpenses = (dashboardData.expensesSharedWithMe || []).filter(
      (p) => p.status === 'PENDING'
    ).length

    return successResponse({
      month: monthKey,
      summary,
      budgetProgress,
      recentTransactions,
      pendingSharedExpenses,
    })
  } catch (error) {
    serverLogger.error('Failed to fetch dashboard data', { action: 'GET /api/v1/dashboard' }, error)
    return serverError('Unable to fetch dashboard data')
  }
}
