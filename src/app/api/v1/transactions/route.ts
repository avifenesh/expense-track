import { NextRequest } from 'next/server'
import { requireJwtAuth } from '@/lib/api-auth'
import { createTransaction } from '@/lib/services/transaction-service'
import { transactionSchema } from '@/schemas'
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
import { getMonthStartFromKey, formatDateForApi } from '@/utils/date'
import { TransactionType } from '@prisma/client'
import { serverLogger } from '@/lib/server-logger'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

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
  const accountId = searchParams.get('accountId')
  const monthKey = searchParams.get('month')
  const categoryId = searchParams.get('categoryId')
  const type = searchParams.get('type')
  const limitParam = searchParams.get('limit')
  const offsetParam = searchParams.get('offset')

  // Validate required accountId
  if (!accountId) {
    return validationError({ accountId: ['accountId is required'] })
  }

  // Validate type if provided
  if (type && !['INCOME', 'EXPENSE'].includes(type)) {
    return validationError({ type: ['type must be INCOME or EXPENSE'] })
  }

  // Parse pagination
  let limit = DEFAULT_LIMIT
  let offset = 0

  if (limitParam) {
    const parsed = parseInt(limitParam, 10)
    if (isNaN(parsed) || parsed < 1) {
      return validationError({ limit: ['limit must be a positive integer'] })
    }
    limit = Math.min(parsed, MAX_LIMIT)
  }

  if (offsetParam) {
    const parsed = parseInt(offsetParam, 10)
    if (isNaN(parsed) || parsed < 0) {
      return validationError({ offset: ['offset must be a non-negative integer'] })
    }
    offset = parsed
  }

  // 3. Authorize account access by userId (single check to prevent enumeration)
  const account = await prisma.account.findUnique({ where: { id: accountId } })
  if (!account || account.userId !== user.userId) {
    return forbiddenError('Access denied')
  }

  // 4. Build query filters
  const where: {
    accountId: string
    month?: Date
    categoryId?: string
    type?: TransactionType
  } = { accountId }

  if (monthKey) {
    try {
      where.month = getMonthStartFromKey(monthKey)
    } catch {
      return validationError({ month: ['month must be in YYYY-MM format'] })
    }
  }

  if (categoryId) {
    where.categoryId = categoryId
  }

  if (type) {
    where.type = type as TransactionType
  }

  // 5. Execute query with pagination
  try {
    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              type: true,
              color: true,
            },
          },
        },
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.transaction.count({ where }),
    ])

    const hasMore = offset + transactions.length < total

    return successResponse({
      transactions: transactions.map((t) => ({
        id: t.id,
        accountId: t.accountId,
        categoryId: t.categoryId,
        type: t.type,
        amount: t.amount.toString(),
        currency: t.currency,
        date: formatDateForApi(t.date),
        month: formatDateForApi(t.month),
        description: t.description,
        isRecurring: t.isRecurring,
        category: t.category,
      })),
      total,
      hasMore,
    })
  } catch (error) {
    serverLogger.error('Failed to fetch transactions', { action: 'GET /api/v1/transactions' }, error)
    return serverError('Unable to fetch transactions')
  }
}

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

  // Omit csrfToken for API (not needed with JWT)
  const apiSchema = transactionSchema.omit({ csrfToken: true })
  const parsed = apiSchema.safeParse(body)

  if (!parsed.success) {
    return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
  }

  const data = parsed.data

  // 3. Authorize account access by userId (single check to prevent enumeration)
  const account = await prisma.account.findUnique({ where: { id: data.accountId } })
  if (!account || account.userId !== user.userId) {
    return forbiddenError('Access denied')
  }

  // 4. Execute business logic via service
  try {
    const transaction = await createTransaction(data)
    return successResponse({ id: transaction.id }, 201)
  } catch {
    return serverError('Unable to create transaction')
  }
}
