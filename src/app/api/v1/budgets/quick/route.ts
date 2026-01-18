import { NextRequest } from 'next/server'
import { withApiAuth, parseJsonBody } from '@/lib/api-middleware'
import { validationError, successResponse, forbiddenError } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { Currency } from '@prisma/client'
import { getMonthStartFromKey } from '@/utils/date'
import { z } from 'zod'

const quickBudgetSchema = z.object({
  accountId: z.string().min(1, 'Account is required'),
  categoryId: z.string().min(1, 'Category is required'),
  monthKey: z.string().regex(/^\d{4}-\d{2}$/, 'Invalid month format (expected YYYY-MM)'),
  planned: z.coerce.number().min(0, 'Budget must be >= 0'),
  currency: z.nativeEnum(Currency).default(Currency.USD),
})

/**
 * POST /api/v1/budgets/quick
 *
 * Creates a budget for the specified account, category, and month.
 * Used during onboarding to quickly set up a budget.
 *
 * @body accountId - Required. Account ID.
 * @body categoryId - Required. Category ID.
 * @body monthKey - Required. Month key (YYYY-MM).
 * @body planned - Required. Planned budget amount.
 * @body currency - Optional. Currency (defaults to USD).
 *
 * @returns {Object} { success: true }
 * @throws {400} Validation error - Invalid input
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - Subscription expired or access denied
 * @throws {429} Rate limited - Too many requests
 */
export async function POST(request: NextRequest) {
  return withApiAuth(
    request,
    async (user) => {
      const body = await parseJsonBody(request)
      if (body === null) {
        return validationError({ body: ['Invalid JSON'] })
      }

      const parsed = quickBudgetSchema.safeParse(body)
      if (!parsed.success) {
        return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
      }

      const data = parsed.data

      // Verify account belongs to user
      const account = await prisma.account.findFirst({
        where: { id: data.accountId, userId: user.userId, deletedAt: null },
      })
      if (!account) {
        return forbiddenError('Account not found or access denied')
      }

      // Verify category belongs to user
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId: user.userId },
      })
      if (!category) {
        return forbiddenError('Category not found or access denied')
      }

      const month = getMonthStartFromKey(data.monthKey)

      await prisma.budget.upsert({
        where: {
          accountId_categoryId_month: {
            accountId: data.accountId,
            categoryId: data.categoryId,
            month,
          },
        },
        create: {
          accountId: data.accountId,
          categoryId: data.categoryId,
          month,
          planned: data.planned,
          currency: data.currency,
        },
        update: {
          planned: data.planned,
          currency: data.currency,
        },
      })

      return successResponse({ success: true }, 201)
    },
    { requireSubscription: true },
  )
}
