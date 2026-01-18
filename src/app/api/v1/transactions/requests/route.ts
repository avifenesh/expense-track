import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { createTransactionRequest } from '@/lib/services/transaction-service'
import { transactionRequestSchema } from '@/schemas'
import {
  validationError,
  authError,
  serverError,
  successResponse,
  rateLimitError,
  checkSubscription,
} from '@/lib/api-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { prisma } from '@/lib/prisma'
import { serverLogger } from '@/lib/server-logger'

/**
 * POST /api/v1/transactions/requests
 *
 * Creates a new transaction request (money transfer between users).
 *
 * @body toId - Required. The recipient account ID.
 * @body categoryId - Required. The category for the transaction.
 * @body amount - Required. Transaction amount (positive number).
 * @body currency - Required. Currency code (USD, EUR, or ILS).
 * @body date - Required. Transaction date (YYYY-MM-DD or ISO format).
 * @body description - Optional. Transaction description.
 *
 * @returns {Object} { id: string } - The created request ID
 * @throws {400} Validation error - Invalid input data
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to create request or identify primary account
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

  const apiSchema = transactionRequestSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Get user's primary account by userId (the 'from' account)
  const fromAccount = await prisma.account.findFirst({
    where: { userId: user.userId, type: 'SELF', deletedAt: null },
  })

  if (!fromAccount) {
    return serverError('Unable to identify your primary account')
  }

  // 4. Create transaction request
  try {
    const transactionRequest = await createTransactionRequest({
      fromId: fromAccount.id,
      toId: data.toId,
      categoryId: data.categoryId,
      amount: data.amount,
      currency: data.currency,
      date: data.date,
      description: data.description,
    })
    return successResponse({ id: transactionRequest.id }, 201)
  } catch (error) {
    serverLogger.error('Failed to create transaction request', { action: 'POST /api/v1/transactions/requests' }, error)
    return serverError('Unable to create transaction request')
  }
}
