import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { requireJwtAuth, type JwtUser } from '@/lib/api-auth'
import { checkRateLimit, incrementRateLimit, type RateLimitType } from '@/lib/rate-limit'
import { authError, rateLimitError, serverError, checkSubscription } from '@/lib/api-helpers'
import { serverLogger } from '@/lib/server-logger'

/** Options for API middleware */
export interface ApiMiddlewareOptions {
  /** Rate limit type to use (defaults to 'default') */
  rateLimitType?: RateLimitType
  /** Whether to require an active subscription (defaults to false for GET, true for mutations) */
  requireSubscription?: boolean
  /** Skip rate limiting entirely (use sparingly) */
  skipRateLimit?: boolean
}

/**
 * Wraps an API handler with authentication, rate limiting, and error handling.
 * Reduces boilerplate in API routes by centralizing common checks.
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   return withApiAuth(request, async (user) => {
 *     const data = await fetchData(user.userId)
 *     return successResponse(data)
 *   })
 * }
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   return withApiAuth(request, async (user) => {
 *     const body = await parseJsonBody(request)
 *     if (body === null) {
 *       return validationError({ body: ['Invalid JSON'] })
 *     }
 *     const result = await createResource(user.userId, body)
 *     return successResponse(result, 201)
 *   }, { requireSubscription: true })
 * }
 */
export async function withApiAuth(
  request: NextRequest,
  handler: (user: JwtUser) => Promise<NextResponse>,
  options: ApiMiddlewareOptions = {},
): Promise<NextResponse> {
  const { rateLimitType = 'default', requireSubscription = false, skipRateLimit = false } = options

  // 1. Authenticate with JWT
  let user: JwtUser
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }

  // 2. Rate limit check
  if (!skipRateLimit) {
    const rateLimit = checkRateLimit(user.userId, rateLimitType)
    if (!rateLimit.allowed) {
      return rateLimitError(rateLimit.resetAt)
    }
    incrementRateLimit(user.userId, rateLimitType)
  }

  // 3. Subscription check (if required)
  if (requireSubscription) {
    const subscriptionError = await checkSubscription(user.userId)
    if (subscriptionError) return subscriptionError
  }

  // 4. Execute handler with error boundary
  try {
    return await handler(user)
  } catch (error) {
    serverLogger.error(
      'Unhandled API error',
      { path: request.nextUrl.pathname, method: request.method, userId: user.userId },
      error,
    )
    return serverError('An unexpected error occurred')
  }
}

/**
 * Safely parse JSON body from request.
 * Returns null if parsing fails, logging the error for debugging.
 */
export async function parseJsonBody<T = unknown>(request: NextRequest): Promise<T | null> {
  try {
    return (await request.json()) as T
  } catch (error) {
    serverLogger.warn('Failed to parse JSON body', { path: request.nextUrl.pathname, method: request.method }, error)
    return null
  }
}
