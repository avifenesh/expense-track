import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { createCategory } from '@/lib/services/category-service'
import { categorySchema } from '@/schemas'
import { validationError, authError, serverError, successResponse, rateLimitError } from '@/lib/api-helpers'
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

  // 2. Parse and validate input
  let body
  try {
    body = await request.json()
  } catch {
    return validationError({ body: ['Invalid JSON'] })
  }

  const apiSchema = categorySchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Execute create (categories are scoped to user)
  try {
    const category = await createCategory({
      userId: user.userId,
      name: data.name,
      type: data.type,
      color: data.color,
    })
    return successResponse({ id: category.id }, 201)
  } catch {
    return serverError('Category already exists')
  }
}
