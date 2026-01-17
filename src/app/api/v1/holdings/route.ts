import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { createHolding } from '@/lib/services/holding-service'
import { validateHoldingCategory, validateStockSymbol } from '@/lib/services/holding-service'
import { holdingSchema } from '@/schemas'
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
 * POST /api/v1/holdings
 *
 * Creates a new stock/investment holding.
 *
 * @body accountId - Required. The account to create the holding in.
 * @body categoryId - Required. The holding category (must have isHolding=true).
 * @body symbol - Required. Stock ticker symbol (validated against API).
 * @body name - Required. Holding display name.
 * @body quantity - Required. Number of shares/units.
 * @body averageCost - Required. Average cost per share.
 * @body currency - Required. Currency code (USD, EUR, or ILS).
 *
 * @returns {Holding} The created holding with all fields
 * @throws {400} Validation error - Invalid input, symbol, or category
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User doesn't own the account or subscription expired
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Holding may already exist
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
  const accountOwnership = await ensureApiAccountOwnership(data.accountId, user.userId)
  if (!accountOwnership.allowed) {
    return forbiddenError('Access denied')
  }

  // 5. Validate category has isHolding = true
  try {
    await validateHoldingCategory(data.categoryId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid category'
    return validationError({ categoryId: [message] })
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
    return successResponse(
      {
        id: holding.id,
        accountId: holding.accountId,
        categoryId: holding.categoryId,
        symbol: holding.symbol,
        name: holding.name,
        quantity: holding.quantity.toString(),
        averageCost: holding.averageCost.toString(),
        currency: holding.currency,
      },
      201,
    )
  } catch (error) {
    serverLogger.error('Failed to create holding', { action: 'POST /api/v1/holdings' }, error)
    return serverError('Unable to create holding. It may already exist.')
  }
}
