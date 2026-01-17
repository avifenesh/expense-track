import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { createCategory } from '@/lib/services/category-service'
import { categorySchema } from '@/schemas'
import { validationError, authError, serverError, successResponse, rateLimitError, checkSubscription } from '@/lib/api-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { TransactionType } from '@prisma/client'
import { serverLogger } from '@/lib/server-logger'

export async function GET(request: NextRequest) {
  // 1. Authenticate with JWT
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

  // Note: No subscription check for GET - users can always view their data

  // 2. Parse query parameters
  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type')
  const includeArchived = searchParams.get('includeArchived') === 'true'

  // Validate type if provided
  if (type && !['INCOME', 'EXPENSE'].includes(type)) {
    return validationError({ type: ['type must be INCOME or EXPENSE'] })
  }

  // 3. Build query filters (categories are user-scoped)
  const where: {
    userId: string
    type?: TransactionType
    isArchived?: boolean
  } = { userId: user.userId }

  if (type) {
    where.type = type as TransactionType
  }

  if (!includeArchived) {
    where.isArchived = false
  }

  // 4. Execute query
  try {
    const categories = await prisma.category.findMany({
      where,
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    })

    return successResponse({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        type: c.type,
        color: c.color,
        isArchived: c.isArchived,
        isHolding: c.isHolding,
        userId: c.userId,
      })),
    })
  } catch (error) {
    serverLogger.error('Failed to fetch categories', { action: 'GET /api/v1/categories' }, error)
    return serverError('Unable to fetch categories')
  }
}

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

  const apiSchema = categorySchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 4. Execute create (categories are scoped to user)
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
