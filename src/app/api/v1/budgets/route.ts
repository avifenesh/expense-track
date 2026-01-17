import { NextRequest } from 'next/server'
import { withApiAuth, parseJsonBody } from '@/lib/api-middleware'
import { upsertBudget, deleteBudget, getBudgetByKey } from '@/lib/services/budget-service'
import { budgetApiSchema, deleteBudgetApiSchema } from '@/schemas/api'
import { validationError, forbiddenError, notFoundError, serverError, successResponse } from '@/lib/api-helpers'
import { ensureResourceOwnership } from '@/lib/api-auth-helpers'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey, formatDateForApi } from '@/utils/date'
import { serverLogger } from '@/lib/server-logger'

/** Helper to verify account ownership */
async function verifyAccountOwnership(accountId: string, userId: string) {
  return ensureResourceOwnership(
    () => prisma.account.findFirst({ where: { id: accountId, userId } }),
    'Account',
  )
}

/**
 * GET /api/v1/budgets
 *
 * Retrieves budgets for an authenticated user's account.
 *
 * @query accountId - Required. The account to fetch budgets from.
 * @query month - Optional. Filter by month (YYYY-MM format).
 *
 * @returns {Object} { budgets: Budget[] }
 * @throws {400} Validation error - Missing or invalid parameters
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User doesn't own the account
 * @throws {429} Rate limited - Too many requests
 */
export async function GET(request: NextRequest) {
  return withApiAuth(request, async (user) => {
    // Parse query parameters with explicit validation
    const { searchParams } = new URL(request.url)
    const accountId = searchParams.get('accountId')
    const monthKey = searchParams.get('month')

    // Validate required accountId (explicit null check)
    if (accountId === null || accountId === '') {
      return validationError({ accountId: ['accountId is required'] })
    }

    // Authorize account access using centralized helper
    const accountCheck = await verifyAccountOwnership(accountId, user.userId)
    if (!accountCheck.allowed) {
      return forbiddenError('Access denied')
    }

    // Build query filters
    const where: {
      accountId: string
      month?: Date
    } = { accountId }

    // Validate month format if provided (explicit null check)
    if (monthKey !== null && monthKey !== '') {
      try {
        where.month = getMonthStartFromKey(monthKey)
      } catch {
        return validationError({ month: ['month must be in YYYY-MM format'] })
      }
    }

    // Execute query
    const budgets = await prisma.budget.findMany({
      where,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            type: true,
            color: true,
          },
        },
      },
      orderBy: [{ month: 'desc' }, { category: { name: 'asc' } }],
    })

    return successResponse({
      budgets: budgets.map((b) => ({
        id: b.id,
        accountId: b.accountId,
        categoryId: b.categoryId,
        month: formatDateForApi(b.month),
        planned: b.planned.toString(),
        currency: b.currency,
        notes: b.notes,
        category: b.category,
      })),
    })
  })
}

/**
 * POST /api/v1/budgets
 *
 * Creates or updates a budget for a specific account/category/month combination.
 *
 * @body accountId - Required. The account for the budget.
 * @body categoryId - Required. The category for the budget.
 * @body monthKey - Required. The month (YYYY-MM format).
 * @body planned - Required. The planned budget amount.
 * @body currency - Required. Currency code (USD, EUR, or ILS).
 * @body notes - Optional. Budget notes.
 *
 * @returns {Budget} The created/updated budget with all fields
 * @throws {400} Validation error - Invalid input data
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User doesn't own the account or subscription expired
 * @throws {429} Rate limited - Too many requests
 */
export async function POST(request: NextRequest) {
  return withApiAuth(
    request,
    async (user) => {
      // Parse and validate input
      const body = await parseJsonBody(request)
      if (body === null) {
        return validationError({ body: ['Invalid JSON'] })
      }

      const parsed = budgetApiSchema.safeParse(body)
      if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
      }

      const data = parsed.data
      const month = getMonthStartFromKey(data.monthKey)

      // Authorize account access using centralized helper
      const accountCheck = await verifyAccountOwnership(data.accountId, user.userId)
      if (!accountCheck.allowed) {
        return forbiddenError('Access denied')
      }

      // Check if budget exists (to determine 201 vs 200 status)
      const existing = await getBudgetByKey({ accountId: data.accountId, categoryId: data.categoryId, month })

      // Execute upsert
      try {
        const budget = await upsertBudget({
          accountId: data.accountId,
          categoryId: data.categoryId,
          month,
          planned: data.planned,
          currency: data.currency,
          notes: data.notes,
        })
        // Return 201 for create, 200 for update - return full budget
        return successResponse(
          {
            id: budget.id,
            accountId: budget.accountId,
            categoryId: budget.categoryId,
            month: formatDateForApi(budget.month),
            planned: budget.planned.toString(),
            currency: budget.currency,
            notes: budget.notes,
          },
          existing ? 200 : 201,
        )
      } catch (error) {
        serverLogger.error('Failed to save budget', { action: 'POST /api/v1/budgets', userId: user.userId }, error)
        return serverError('Unable to save budget')
      }
    },
    { requireSubscription: true },
  )
}

/**
 * DELETE /api/v1/budgets
 *
 * Deletes a budget entry for a specific account/category/month combination.
 *
 * @query accountId - Required. The account ID.
 * @query categoryId - Required. The category ID.
 * @query monthKey - Required. The month (YYYY-MM format).
 *
 * @returns {Object} { deleted: true }
 * @throws {400} Validation error - Missing or invalid parameters
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User doesn't own the account or subscription expired
 * @throws {404} Not found - Budget entry does not exist
 * @throws {429} Rate limited - Too many requests
 */
export async function DELETE(request: NextRequest) {
  return withApiAuth(
    request,
    async (user) => {
      // Parse and validate query params with explicit null checks
      const url = new URL(request.url)
      const accountId = url.searchParams.get('accountId')
      const categoryId = url.searchParams.get('categoryId')
      const monthKey = url.searchParams.get('monthKey')

      // Validate all required params are present (explicit null checks)
      const parsed = deleteBudgetApiSchema.safeParse({ accountId, categoryId, monthKey })
      if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
      }

      const data = parsed.data
      const month = getMonthStartFromKey(data.monthKey)

      // Authorize account access using centralized helper
      const accountCheck = await verifyAccountOwnership(data.accountId, user.userId)
      if (!accountCheck.allowed) {
        return forbiddenError('Access denied')
      }

      // Check budget exists
      const existing = await getBudgetByKey({ accountId: data.accountId, categoryId: data.categoryId, month })
      if (!existing) {
        return notFoundError('Budget entry not found')
      }

      // Execute delete
      try {
        await deleteBudget({ accountId: data.accountId, categoryId: data.categoryId, month })
        return successResponse({ deleted: true })
      } catch (error) {
        serverLogger.error('Failed to delete budget', { action: 'DELETE /api/v1/budgets', userId: user.userId }, error)
        return serverError('Unable to delete budget')
      }
    },
    { requireSubscription: true },
  )
}
