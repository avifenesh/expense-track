import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { archiveCategory, getCategoryById } from '@/lib/services/category-service'
import { archiveCategorySchema } from '@/schemas'
import {
  validationError,
  authError,
  forbiddenError,
  notFoundError,
  serverError,
  successResponse,
  rateLimitError,
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

  // 3. Check category exists and belongs to user
  const existing = await getCategoryById(id, user.userId)
  if (!existing) {
    return notFoundError('Category not found')
  }

  // 4. Verify ownership (category belongs to authenticated user)
  if (existing.userId !== user.userId) {
    return forbiddenError('You do not have access to this category')
  }

  // 5. Execute archive
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
