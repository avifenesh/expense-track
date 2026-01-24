import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { getCategoryById, updateCategory } from '@/lib/services/category-service'
import { updateCategoryApiSchema } from '@/schemas/api'
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
 * PUT /api/v1/categories/[id]
 *
 * Updates a category's name and/or color.
 *
 * @param id - The category ID (path parameter)
 * @body name - Required. The new category name (2-100 chars).
 * @body color - Optional. The new category color (hex format, e.g., #FF0000).
 *
 * @returns {Object} The updated category { id, name, type, color, isArchived, isHolding, userId }
 * @throws {400} Validation error - Invalid input data or duplicate name
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - Subscription expired
 * @throws {404} Not found - Category does not exist
 * @throws {429} Rate limited - Too many requests
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = updateCategoryApiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Check category exists and belongs to user (userId filter prevents cross-user access)
  const existing = await getCategoryById(id, user.userId)
  if (!existing) {
    return notFoundError('Category not found')
  }

  // 4. Execute update
  try {
    const result = await updateCategory({
      id,
      userId: user.userId,
      name: data.name,
      color: data.color,
    })

    if (!result.success) {
      return validationError({ name: ['A category with this name already exists'] })
    }

    const category = result.category
    return successResponse({
      id: category.id,
      name: category.name,
      type: category.type,
      color: category.color,
      isArchived: category.isArchived,
      isHolding: category.isHolding,
      userId: category.userId,
    })
  } catch {
    return serverError('Unable to update category')
  }
}
