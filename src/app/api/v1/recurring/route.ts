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
import { ensureApiAccountOwnership, ensureApiRecurringOwnership } from '@/lib/api-auth-helpers'
import { getMonthStartFromKey, formatDateForApi } from '@/utils/date'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { serverLogger } from '@/lib/server-logger'

/**
 * POST /api/v1/recurring
 *
 * Creates or updates a recurring transaction template.
 *
 * @body id - Optional. Template ID for updates.
 * @body accountId - Required. The account for the template.
 * @body categoryId - Required. The category for generated transactions.
 * @body type - Required. Transaction type (INCOME or EXPENSE).
 * @body amount - Required. Transaction amount.
 * @body currency - Required. Currency code (USD, EUR, or ILS).
 * @body dayOfMonth - Required. Day of month to generate transaction (1-31).
 * @body description - Optional. Transaction description.
 * @body startMonthKey - Required. Start month (YYYY-MM format).
 * @body endMonthKey - Optional. End month (YYYY-MM format).
 * @body isActive - Optional. Whether template is active (default: true).
 *
 * @returns {RecurringTemplate} The created/updated template with all fields
 * @throws {400} Validation error - Invalid input data
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User doesn't own the account/template or subscription expired
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to save template
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

  const parsed = recurringTemplateApiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data
  const startMonth = getMonthStartFromKey(data.startMonthKey)
  const endMonth = data.endMonthKey ? getMonthStartFromKey(data.endMonthKey) : null
  // Schema's .refine() ensures endMonth >= startMonth, replacing the previous manual validation

  // 3. Authorize account access by userId (single check to prevent enumeration)
  const accountOwnership = await ensureApiAccountOwnership(data.accountId, user.userId)
  if (!accountOwnership.allowed) {
    return forbiddenError('Access denied')
  }

  // 4. If updating, verify existing template belongs to the user
  if (data.id) {
    const templateOwnership = await ensureApiRecurringOwnership(data.id, user.userId)
    if (!templateOwnership.allowed) {
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
    return successResponse(
      {
        id: template.id,
        accountId: template.accountId,
        categoryId: template.categoryId,
        type: template.type,
        amount: template.amount.toString(),
        currency: template.currency,
        dayOfMonth: template.dayOfMonth,
        description: template.description,
        startMonth: formatDateForApi(template.startMonth),
        endMonth: template.endMonth ? formatDateForApi(template.endMonth) : null,
        isActive: template.isActive,
      },
      data.id ? 200 : 201,
    )
  } catch (error) {
    serverLogger.error('Failed to save recurring template', { action: 'POST /api/v1/recurring' }, error)
    return serverError('Unable to save recurring template')
  }
}
