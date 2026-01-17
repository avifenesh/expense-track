import { NextRequest } from 'next/server'
import { requireJwtAuth, getUserAuthInfo } from '@/lib/api-auth'
import { upsertBudget, deleteBudget, getBudgetByKey } from '@/lib/services/budget-service'
import { budgetSchema, deleteBudgetSchema } from '@/schemas'
import {
  validationError,
  authError,
  forbiddenError,
  notFoundError,
  serverError,
  successResponse,
  rateLimitError,
  checkSubscription,
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  // 1. Authenticate with JWT
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 1.5 Rate limit check
  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

  // 1.6 Subscription check
  const subscriptionError = await checkSubscription(user.userId)
  if (subscriptionError) return subscriptionError

  // 2. Parse query parameters
  const { searchParams } = new URL(request.url)
  const accountId = searchParams.get('accountId')
  const monthKey = searchParams.get('month')

  // Validate required accountId
  if (!accountId) {
    return validationError({ accountId: ['accountId is required'] })
  }

  // 3. Authorize account access
  const account = await prisma.account.findUnique({ where: { id: accountId } })
  if (!account) {
    return forbiddenError('Account not found')
  }

  const authUser = await getUserAuthInfo(user.userId)
  if (!authUser.accountNames.includes(account.name)) {
    return forbiddenError('You do not have access to this account')
  }

  // 4. Build query filters
  const where: {
    accountId: string
    month?: Date
  } = { accountId }

  if (monthKey) {
    try {
      where.month = getMonthStartFromKey(monthKey)
    } catch {
      return validationError({ month: ['month must be in YYYY-MM format'] })
    }
  }

  // 5. Execute query
  try {
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
        month: b.month.toISOString().split('T')[0],
        planned: b.planned.toString(),
        currency: b.currency,
        notes: b.notes,
        category: b.category,
      })),
    })
  } catch {
    return serverError('Unable to fetch budgets')
  }
}

export async function POST(request: NextRequest) {
  // 1. Authenticate
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 1.5 Rate limit check
  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

  // 1.6 Subscription check
  const subscriptionError = await checkSubscription(user.userId)
  if (subscriptionError) return subscriptionError

  // 2. Parse and validate input
  let body
  try {
    body = await request.json()
  } catch {
    return validationError({ body: ['Invalid JSON'] })
  }

  const apiSchema = budgetSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data
  const month = getMonthStartFromKey(data.monthKey)

  // 3. Authorize account access
  const account = await prisma.account.findUnique({ where: { id: data.accountId } })
  if (!account) {
    return forbiddenError('Account not found')
  }

  const authUser = await getUserAuthInfo(user.userId)
  if (!authUser.accountNames.includes(account.name)) {
    return forbiddenError('You do not have access to this account')
  }

  // 4. Execute upsert
  try {
    const budget = await upsertBudget({
      accountId: data.accountId,
      categoryId: data.categoryId,
      month,
      planned: data.planned,
      currency: data.currency,
      notes: data.notes,
    })
    return successResponse({ id: budget.id }, 200)
  } catch {
    return serverError('Unable to save budget')
  }
}

export async function DELETE(request: NextRequest) {
  // 1. Authenticate
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 1.5 Rate limit check
  const rateLimitCheck = checkRateLimit(user.userId)
  if (!rateLimitCheck.allowed) {
    return rateLimitError(rateLimitCheck.resetAt)
  }
  incrementRateLimit(user.userId)

  // 1.6 Subscription check
  const subscriptionError = await checkSubscription(user.userId)
  if (subscriptionError) return subscriptionError

  // 2. Parse and validate query params
  const url = new URL(request.url)
  const accountId = url.searchParams.get('accountId')
  const categoryId = url.searchParams.get('categoryId')
  const monthKey = url.searchParams.get('monthKey')

  const apiSchema = deleteBudgetSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse({ accountId, categoryId, monthKey })

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data
  const month = getMonthStartFromKey(data.monthKey)

  // 3. Authorize account access
  const account = await prisma.account.findUnique({ where: { id: data.accountId } })
  if (!account) {
    return forbiddenError('Account not found')
  }

  const authUser = await getUserAuthInfo(user.userId)
  if (!authUser.accountNames.includes(account.name)) {
    return forbiddenError('You do not have access to this account')
  }

  // 4. Check budget exists
  const existing = await getBudgetByKey({ accountId: data.accountId, categoryId: data.categoryId, month })
  if (!existing) {
    return notFoundError('Budget entry not found')
  }

  // 5. Execute delete
  try {
    await deleteBudget({ accountId: data.accountId, categoryId: data.categoryId, month })
    return successResponse({ deleted: true })
  } catch {
    return serverError('Unable to delete budget')
  }
}
