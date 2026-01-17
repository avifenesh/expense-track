import { NextRequest } from 'next/server'
import { requireJwtAuth, getUserAuthInfo } from '@/lib/api-auth'
import { upsertRecurringTemplate } from '@/lib/services/recurring-service'
import { recurringTemplateSchema } from '@/schemas'
import {
  validationError,
  authError,
  forbiddenError,
  serverError,
  successResponse,
  rateLimitError,
  checkSubscription,
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

  const apiSchema = recurringTemplateSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data
  const startMonth = getMonthStartFromKey(data.startMonthKey)
  const endMonth = data.endMonthKey ? getMonthStartFromKey(data.endMonthKey) : null

  // Validate end month is after start month
  if (endMonth && endMonth < startMonth) {
    return validationError({ endMonthKey: ['End month must be after the start month'] })
  }

  // 3. Authorize account access
  const account = await prisma.account.findUnique({ where: { id: data.accountId } })
  if (!account) return forbiddenError('Account not found')

  const authUser = await getUserAuthInfo(user.userId)
  if (!authUser.accountNames.includes(account.name)) {
    return forbiddenError('You do not have access to this account')
  }

  // 3b. If updating, verify existing template belongs to the requested account
  if (data.id) {
    const existing = await prisma.recurringTemplate.findUnique({ where: { id: data.id } })
    if (!existing) {
      return forbiddenError('Template not found')
    }
    if (existing.accountId !== data.accountId) {
      return forbiddenError('Cannot change template account')
    }
  }

  // 4. Execute upsert
  try {
    const template = await upsertRecurringTemplate({
      id: data.id,
      accountId: data.accountId,
      categoryId: data.categoryId,
      type: data.type,
      amount: data.amount,
      currency: data.currency,
      dayOfMonth: data.dayOfMonth,
      description: data.description,
      startMonth,
      endMonth,
      isActive: data.isActive,
    })
    return successResponse({ id: template.id }, data.id ? 200 : 201)
  } catch {
    return serverError('Unable to save recurring template')
  }
}
