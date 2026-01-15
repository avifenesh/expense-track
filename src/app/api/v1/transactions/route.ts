import { NextRequest } from 'next/server'
import { requireJwtAuth, getUserAuthInfo } from '@/lib/api-auth'
import { createTransaction } from '@/lib/services/transaction-service'
import { transactionSchema } from '@/schemas'
import {
  validationError,
  authError,
  forbiddenError,
  serverError,
  successResponse,
  rateLimitError,
} from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
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

  // 2. Parse and validate input
  let body
  try {
    body = await request.json()
  } catch {
    return validationError({ body: ['Invalid JSON'] })
  }

  // Omit csrfToken for API (not needed with JWT)
  const apiSchema = transactionSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Authorize account access
  const account = await prisma.account.findUnique({ where: { id: data.accountId } })
  if (!account) {
    return forbiddenError('Account not found')
  }

  const authUser = getUserAuthInfo(user.userId)
  if (!authUser.accountNames.includes(account.name)) {
    return forbiddenError('You do not have access to this account')
  }

  // 4. Execute business logic via service
  try {
    const transaction = await createTransaction(data)
    return successResponse({ id: transaction.id }, 201)
  } catch {
    return serverError('Unable to create transaction')
  }
}
