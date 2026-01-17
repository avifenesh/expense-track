import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { toggleRecurringTemplate, getRecurringTemplateById } from '@/lib/services/recurring-service'
import { toggleRecurringSchema } from '@/schemas'
import {
  validationError,
  authError,
  notFoundError,
  serverError,
  successResponse,
  rateLimitError,
  checkSubscription,
} from '@/lib/api-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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

  const apiSchema = toggleRecurringSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse({ ...body, id })

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Check template exists and belongs to user (via account)
  const existing = await getRecurringTemplateById(id, user.userId)
  if (!existing) {
    return notFoundError('Recurring template not found')
  }

  // 4. Execute toggle
  try {
    await toggleRecurringTemplate(data)
    return successResponse({ id, isActive: data.isActive })
  } catch {
    return serverError('Unable to toggle recurring template')
  }
}
