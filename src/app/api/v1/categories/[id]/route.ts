import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { updateCategory } from '@/lib/services/category-service'
import { ServiceError } from '@/lib/services/errors'
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

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  const rateLimit = checkRateLimit(user.userId)
  if (!rateLimit.allowed) {
    return rateLimitError(rateLimit.resetAt)
  }
  incrementRateLimit(user.userId)

  const subscriptionError = await checkSubscription(user.userId)
  if (subscriptionError) return subscriptionError

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
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'NOT_FOUND') {
      return notFoundError('Category not found')
    }
    return serverError('Unable to update category')
  }
}
