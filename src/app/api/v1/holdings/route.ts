import { NextRequest } from 'next/server'
import { requireJwtAuth, getUserAuthInfo } from '@/lib/api-auth'
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
import { prisma } from '@/lib/prisma'
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

  // 3. Authorize account access
  const account = await prisma.account.findUnique({ where: { id: data.accountId } })
  if (!account) return forbiddenError('Account not found')

  const authUser = await getUserAuthInfo(user.userId)
  if (!authUser.accountNames.includes(account.name)) {
    return forbiddenError('You do not have access to this account')
  }

  // 4. Validate category has isHolding = true
  try {
    await validateHoldingCategory(data.categoryId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid category'
    return validationError({ categoryId: [message] })
  }

  // 5. Validate stock symbol with API
  try {
    await validateStockSymbol(data.symbol)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid symbol'
    return validationError({ symbol: [message] })
  }

  // 6. Execute create
  try {
    const holding = await createHolding(data)
    return successResponse({ id: holding.id }, 201)
  } catch {
    return serverError('Unable to create holding. It may already exist.')
  }
}
