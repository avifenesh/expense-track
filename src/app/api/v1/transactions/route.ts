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
import { ensureApiAccountOwnership } from '@/lib/api-auth-helpers'
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'
import { getMonthStartFromKey, formatDateForApi } from '@/utils/date'
import { TransactionType } from '@prisma/client'
import { serverLogger } from '@/lib/server-logger'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

/**
 * GET /api/v1/transactions
 *
 * Retrieves paginated transactions for an authenticated user's account.
 *
 * @query accountId - Required. The account to fetch transactions from.
 * @query month - Optional. Filter by month (YYYY-MM format).
 * @query categoryId - Optional. Filter by category.
 * @query type - Optional. Filter by type (INCOME or EXPENSE).
 * @query limit - Optional. Number of results (default: 50, max: 100).
 * @query offset - Optional. Pagination offset.
 *
 * @returns {Object} { transactions: Transaction[], total: number, hasMore: boolean }
 * @throws {400} Validation error - Missing or invalid parameters
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User doesn't own the account
 * @throws {429} Rate limited - Too many requests
 */
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
  const accountOwnership = await ensureApiAccountOwnership(accountId, user.userId)
  if (!accountOwnership.allowed) {
    return forbiddenError('Access denied')
  }

  // 4. Build query filters
  const where: {
    accountId: string
    month?: Date
    categoryId?: string
    type?: TransactionType
    deletedAt: null
  } = { accountId, deletedAt: null }

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

/**
 * POST /api/v1/transactions
 *
 * Creates a new transaction for an authenticated user's account.
 *
 * @body accountId - Required. The account to create the transaction in.
 * @body categoryId - Required. The category for the transaction.
 * @body type - Required. Transaction type (INCOME or EXPENSE).
 * @body amount - Required. Transaction amount (positive number).
 * @body currency - Required. Currency code (USD, EUR, or ILS).
 * @body date - Required. Transaction date (YYYY-MM-DD or ISO format).
 * @body description - Optional. Transaction description.
 * @body isRecurring - Optional. Whether this is a recurring transaction.
 *
 * @returns {Transaction} The created transaction with all fields
 * @throws {400} Validation error - Invalid input data
 * @throws {401} Unauthorized - Invalid or missing auth token
 * @throws {403} Forbidden - User doesn't own the account or subscription expired
 * @throws {429} Rate limited - Too many requests
 * @throws {500} Server error - Unable to create transaction
 */
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
  const accountOwnership = await ensureApiAccountOwnership(data.accountId, user.userId)
  if (!accountOwnership.allowed) {
    return forbiddenError('Access denied')
  }

  // 4. Execute business logic via service
  try {
    const transaction = await createTransaction(data)
    return successResponse(
      {
        id: transaction.id,
        accountId: transaction.accountId,
        categoryId: transaction.categoryId,
        type: transaction.type,
        amount: transaction.amount.toString(),
        currency: transaction.currency,
        date: formatDateForApi(transaction.date),
        month: formatDateForApi(transaction.month),
        description: transaction.description,
        isRecurring: transaction.isRecurring,
      },
      201,
    )
  } catch (error) {
    serverLogger.error('Failed to create transaction', { action: 'POST /api/v1/transactions' }, error)
    return serverError('Unable to create transaction')
  }
}
