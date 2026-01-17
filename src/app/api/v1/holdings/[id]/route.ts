import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { updateHolding, deleteHolding, getHoldingById } from '@/lib/services/holding-service'
import { updateHoldingSchema } from '@/schemas'
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
 * PUT /api/v1/holdings/[id]
 *
 * Updates an existing holding.
 *
 * @param id - The holding ID (path parameter)
 * @body quantity - Required. Updated number of shares/units.
 * @body averageCost - Required. Updated average cost per share.
 * @body notes - Optional. Holding notes.
 *
 * @returns {Holding} The updated holding with all fields
 * @throws {400} Validation error - Invalid input data
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - Subscription expired
 * @throws {404} Not found - Holding does not exist
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

  const apiSchema = updateHoldingSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse({ ...body, id })

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Check holding exists and belongs to user (via account)
  const existing = await getHoldingById(id, user.userId)
  if (!existing) {
    return notFoundError('Holding not found')
  }

  // 4. Execute update
  try {
    const updated = await updateHolding(data)
    return successResponse({
      id: updated.id,
      accountId: updated.accountId,
      categoryId: updated.categoryId,
      symbol: updated.symbol,
      name: updated.name,
      quantity: updated.quantity.toString(),
      averageCost: updated.averageCost.toString(),
      currency: updated.currency,
    })
  } catch {
    return serverError('Unable to update holding')
  }
}

/**
 * DELETE /api/v1/holdings/[id]
 *
 * Deletes an existing holding.
 *
 * @param id - The holding ID (path parameter)
 *
 * @returns {Object} { id: string } - The deleted holding's ID
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - Subscription expired
 * @throws {404} Not found - Holding does not exist
 * @throws {429} Rate limited - Too many requests
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 1. Authenticate
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 1.5 Rate limit check
  const rateLimitCheck = checkRateLimit(user.userId)
  if (!rateLimitCheck.allowed) {
    return rateLimitError(rateLimitCheck.resetAt)
  }
  incrementRateLimit(user.userId)

  // 1.6 Subscription check
  const subscriptionError = await checkSubscription(user.userId)
  if (subscriptionError) return subscriptionError

  // 2. Check holding exists and belongs to user (via account)
  const existing = await getHoldingById(id, user.userId)
  if (!existing) {
    return notFoundError('Holding not found')
  }

  // 3. Execute delete
  try {
    await deleteHolding(id)
    return successResponse({ id })
  } catch {
    return serverError('Unable to delete holding')
  }
}
