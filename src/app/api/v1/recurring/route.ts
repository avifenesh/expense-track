import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { upsertRecurringTemplate } from '@/lib/services/recurring-service'
import { recurringTemplateApiSchema } from '@/schemas/api'
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
import { serverLogger } from '@/lib/server-logger'

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

  const parsed = recurringTemplateApiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data
  const startMonth = getMonthStartFromKey(data.startMonthKey)
  const endMonth = data.endMonthKey ? getMonthStartFromKey(data.endMonthKey) : null
  // Schema's .refine() ensures endMonth >= startMonth, replacing the previous manual validation

  // 3. Authorize account access by userId (single check to prevent enumeration)
  const account = await prisma.account.findUnique({ where: { id: data.accountId } })
  if (!account || account.userId !== user.userId) {
    return forbiddenError('Access denied')
  }

  // 4. If updating, verify existing template belongs to the requested account
  if (data.id) {
    const existing = await prisma.recurringTemplate.findUnique({ where: { id: data.id } })
    if (!existing || existing.accountId !== data.accountId) {
      return forbiddenError('Access denied')
    }
  }

  // 5. Execute upsert
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
  } catch (error) {
    serverLogger.error('Failed to save recurring template', { action: 'POST /api/v1/recurring' }, error)
    return serverError('Unable to save recurring template')
  }
}
