import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { createHolding } from '@/lib/services/holding-service'
import { validateHoldingCategory, validateStockSymbol } from '@/lib/services/holding-service'
import { holdingSchema } from '@/schemas'
import {
  validationError,
  authError,
  forbiddenError,
  notFoundError,
  serverError,
  successResponse,
  rateLimitError,
  checkSubscription,
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { serverLogger } from '@/lib/server-logger'
import { NotFoundError, ValidationError, isServiceError } from '@/lib/services/errors'

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

  const apiSchema = holdingSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse({
    ...body,
    symbol: body.symbol?.toUpperCase(),
  })

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Authorize account access by userId (single check to prevent enumeration)
  const account = await prisma.account.findUnique({ where: { id: data.accountId } })
  if (!account || account.userId !== user.userId) {
    return forbiddenError('Access denied')
  }

  // 5. Validate category has isHolding = true
  try {
    await validateHoldingCategory(data.categoryId)
  } catch (error) {
    if (error instanceof NotFoundError) {
      return notFoundError(error.message)
    }
    if (error instanceof ValidationError) {
      return validationError(error.fieldErrors)
    }
    if (isServiceError(error)) {
      return validationError({ categoryId: [error.message] })
    }
    return validationError({ categoryId: ['Invalid category'] })
  }

  // 6. Validate stock symbol with API
  try {
    await validateStockSymbol(data.symbol)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid symbol'
    return validationError({ symbol: [message] })
  }

  // 7. Execute create
  try {
    const holding = await createHolding(data)
    return successResponse({ id: holding.id }, 201)
  } catch (error) {
    serverLogger.error('Failed to create holding', { action: 'POST /api/v1/holdings' }, error)
    return serverError('Unable to create holding. It may already exist.')
  }
}
