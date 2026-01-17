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
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getMonthStartFromKey } from '@/utils/date'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'

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
    return notFoundError('Account not found')
  }

  const authUser = await getUserAuthInfo(user.userId)
  if (!authUser.accountNames.includes(account.name)) {
    return forbiddenError('You do not have access to this account')
  }

  // 4. Check if budget exists (to determine 201 vs 200 status)
  const existing = await getBudgetByKey({ accountId: data.accountId, categoryId: data.categoryId, month })

  // 5. Execute upsert
  try {
    const budget = await upsertBudget({
      accountId: data.accountId,
      categoryId: data.categoryId,
      month,
      planned: data.planned,
      currency: data.currency,
      notes: data.notes,
    })
    // Return 201 for create, 200 for update
    return successResponse({ id: budget.id }, existing ? 200 : 201)
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
    return notFoundError('Account not found')
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
