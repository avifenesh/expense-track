import { NextResponse } from 'next/server'

/**
 * Standard error response with optional field-level errors
 */
export function errorResponse(
  message: string,
  status: number,
  fieldErrors?: Record<string, string[]>
) {
  const payload = fieldErrors
    ? { error: message, fields: fieldErrors }
    : { error: message }
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
