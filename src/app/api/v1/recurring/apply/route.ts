import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
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
import { ensureApiAccountOwnership } from '@/lib/api-auth-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { serverLogger } from '@/lib/server-logger'

/**
 * POST /api/v1/recurring/apply
 *
 * Applies recurring templates to generate transactions for a specific month.
 *
 * @body accountId - Required. The account to apply templates for.
 * @body monthKey - Required. The target month (YYYY-MM format).
 * @body templateIds - Optional. Specific template IDs to apply (defaults to all active).
 *
 * @returns {Object} { created: number, skipped: number, errors: string[] }
 * @throws {400} Validation error - Invalid input data
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User doesn't own the account or subscription expired
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to create transactions
 */
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

  // 3. Authorize account access by userId (single check to prevent enumeration)
  const accountOwnership = await ensureApiAccountOwnership(data.accountId, user.userId)
  if (!accountOwnership.allowed) {
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
  } catch (error) {
    serverLogger.error('Failed to apply recurring templates', { action: 'POST /api/v1/recurring/apply' }, error)
    return serverError('Unable to create recurring transactions')
  }
}
