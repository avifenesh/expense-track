import { NextResponse } from 'next/server'
import { getSubscriptionState } from './subscription'

/**
 * Standard error response with optional field-level errors
 */
export function errorResponse(message: string, status: number, fieldErrors?: Record<string, string[]>) {
  const payload = fieldErrors ? { error: message, fields: fieldErrors } : { error: message }
  return NextResponse.json(payload, { status })
}

/**
 * 400 Bad Request - Validation errors
 */
export function validationError(fieldErrors: Record<string, string[]>) {
  return errorResponse('Validation failed', 400, fieldErrors)
}

/**
 * 401 Unauthorized - Authentication failure
 */
export function authError(message = 'Unauthorized') {
  return errorResponse(message, 401)
}

/**
 * 403 Forbidden - Authorization failure (valid auth, no access)
 */
export function forbiddenError(message = 'Forbidden') {
  return errorResponse(message, 403)
}

/**
 * 404 Not Found - Resource not found
 */
export function notFoundError(message = 'Resource not found') {
  return errorResponse(message, 404)
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export function rateLimitError(resetAt: Date) {
  const retryAfterSeconds = Math.ceil((resetAt.getTime() - Date.now()) / 1000)
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    {
      status: 429,
      headers: {
        'Retry-After': retryAfterSeconds.toString(),
      },
    },
  )
}

/**
 * 500 Internal Server Error
 */
export function serverError(message = 'Internal server error') {
  return errorResponse(message, 500)
}

/**
 * Success response with data
 */
export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status })
}

/**
 * 403 Subscription Required - User needs active subscription
 */
export function subscriptionRequiredError(message = 'Active subscription required') {
  return NextResponse.json(
    { error: message, code: 'SUBSCRIPTION_REQUIRED' },
    { status: 403 },
  )
}

/**
 * Check if user has an active subscription
 * Returns null if subscription is valid, or a response if not
 */
export async function checkSubscription(userId: string): Promise<NextResponse | null> {
  const state = await getSubscriptionState(userId)
  if (!state.canAccessApp) {
    return subscriptionRequiredError()
  }
  return null
}
