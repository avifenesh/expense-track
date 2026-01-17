import { NextRequest } from 'next/server'
import { requireJwtAuth, getUserAuthInfo } from '@/lib/api-auth'
import { applyRecurringTemplates } from '@/lib/services/recurring-service'
import { applyRecurringSchema } from '@/schemas'
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

  const apiSchema = applyRecurringSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Authorize account access (single check to prevent enumeration)
  const account = await prisma.account.findUnique({ where: { id: data.accountId } })
  const authUser = await getUserAuthInfo(user.userId)
  if (!account || !authUser.accountNames.includes(account.name)) {
    return forbiddenError('Access denied')
  }

  // 4. Execute apply
  try {
    const result = await applyRecurringTemplates({
      monthKey: data.monthKey,
      accountId: data.accountId,
      templateIds: data.templateIds,
    })
    return successResponse(result)
  } catch {
    return serverError('Unable to create recurring transactions')
  }
}
