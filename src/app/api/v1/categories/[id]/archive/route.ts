import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { archiveCategory, getCategoryById } from '@/lib/services/category-service'
import { archiveCategorySchema } from '@/schemas'
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

/**
 * PATCH /api/v1/categories/[id]/archive
 *
 * Archives or unarchives a category.
 *
 * @param id - The category ID (path parameter)
 * @body isArchived - Required. Whether to archive (true) or unarchive (false).
 *
 * @returns {Object} { id: string, isArchived: boolean }
 * @throws {400} Validation error - Invalid input data
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - Subscription expired
 * @throws {404} Not found - Category does not exist
 * @throws {429} Rate limited - Too many requests
 */
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

  const apiSchema = archiveCategorySchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse({ ...body, id })

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Check category exists and belongs to user (userId filter prevents cross-user access)
  const existing = await getCategoryById(id, user.userId)
  if (!existing) {
    return notFoundError('Category not found')
  }

  // 4. Execute archive
  try {
    await archiveCategory({
      id,
      userId: user.userId,
      isArchived: data.isArchived,
    })
    return successResponse({ id, isArchived: data.isArchived })
  } catch {
    return serverError('Unable to archive category')
  }
}
