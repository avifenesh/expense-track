import { NextRequest } from 'next/server'
import { requireJwtAuth, getUserAuthInfo } from '@/lib/api-auth'
import { createTransactionRequest, getUserPrimaryAccount } from '@/lib/services/transaction-service'
import { transactionRequestSchema } from '@/schemas'
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

  const apiSchema = transactionRequestSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Get user's primary account (the 'from' account)
  const authUser = getUserAuthInfo(user.userId)
  const fromAccount = await getUserPrimaryAccount(authUser.accountNames)

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
  } catch {
    return serverError('Unable to create transaction request')
  }
}
