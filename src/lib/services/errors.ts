// Service-layer error types for standardized error handling across the application
// These errors are thrown by service layer code and caught/transformed by action layer

/**
 * Base class for all service-layer errors.
 * Provides consistent error structure across the application.
 */
export class ServiceError extends Error {
  public readonly code: string
  public readonly statusCode: number

  constructor(message: string, code: string, statusCode: number = 500) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.statusCode = statusCode
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, this.constructor)
  }
}

/**
 * Resource not found error (404)
 * Use when a requested resource doesn't exist in the database
 */
export class NotFoundError extends ServiceError {
  public readonly resourceType: string
  public readonly resourceId?: string

  constructor(resourceType: string, resourceId?: string) {
    const message = resourceId
      ? `${resourceType} with ID '${resourceId}' not found`
      : `${resourceType} not found`
    super(message, 'NOT_FOUND', 404)
    this.resourceType = resourceType
    this.resourceId = resourceId
  }
}

/**
 * Authorization error (403)
 * Use when user doesn't have permission to access a resource
 */
export class AuthorizationError extends ServiceError {
  public readonly resourceType?: string
  public readonly resourceId?: string

  constructor(message: string = 'Access denied', resourceType?: string, resourceId?: string) {
    super(message, 'FORBIDDEN', 403)
    this.resourceType = resourceType
    this.resourceId = resourceId
  }
}

/**
 * Authentication error (401)
 * Use when user is not authenticated or session is invalid
 */
export class AuthenticationError extends ServiceError {
  constructor(message: string = 'Authentication required') {
    super(message, 'UNAUTHORIZED', 401)
  }
}

/**
 * Validation error (400)
 * Use when input data fails validation
 */
export class ValidationError extends ServiceError {
  public readonly fieldErrors: Record<string, string[]>

  constructor(fieldErrors: Record<string, string[]>, message: string = 'Validation failed') {
    super(message, 'VALIDATION_ERROR', 400)
    this.fieldErrors = fieldErrors
  }

  /**
   * Create a validation error with a single field error
   */
  static field(field: string, message: string): ValidationError {
    return new ValidationError({ [field]: [message] })
  }

  /**
   * Create a validation error with multiple field errors
   */
  static fields(errors: Record<string, string[]>): ValidationError {
    return new ValidationError(errors)
  }
}

/**
 * Conflict error (409)
 * Use when operation conflicts with existing state (e.g., duplicate entry)
 */
export class ConflictError extends ServiceError {
  public readonly conflictType: string

  constructor(message: string, conflictType: string = 'DUPLICATE') {
    super(message, 'CONFLICT', 409)
    this.conflictType = conflictType
  }
}

/**
 * Rate limit error (429)
 * Use when user has exceeded rate limits
 */
export class RateLimitError extends ServiceError {
  public readonly retryAfter?: number

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'RATE_LIMITED', 429)
    this.retryAfter = retryAfter
  }
}

/**
 * Subscription required error (402)
 * Use when user's subscription doesn't allow the operation
 */
export class SubscriptionRequiredError extends ServiceError {
  public readonly requiredPlan?: string

  constructor(message: string = 'Active subscription required', requiredPlan?: string) {
    super(message, 'SUBSCRIPTION_REQUIRED', 402)
    this.requiredPlan = requiredPlan
  }
}

/**
 * Type guard to check if error is a ServiceError
 */
export function isServiceError(error: unknown): error is ServiceError {
  return error instanceof ServiceError
}

/**
 * Convert a service error to an action-layer error response
 */
export function serviceErrorToActionResult(
  error: ServiceError,
): { success: false; error: Record<string, string[]> } {
  if (error instanceof ValidationError) {
    return { success: false, error: error.fieldErrors }
  }

  // Map other errors to general field
  return {
    success: false,
    error: {
      general: [error.message],
    },
  }
}

/**
 * Options for unified error handling
 */
export interface ErrorHandlingOptions {
  /** Action name for logging context */
  action: string
  /** Generic fallback message for unexpected errors */
  fallbackMessage?: string
}

/**
 * Unified error handler for service layer.
 * Handles ServiceError instances and returns appropriate action results.
 * For Prisma errors, use handlePrismaError from prisma-errors.ts.
 *
 * Usage:
 * ```typescript
 * try {
 *   const result = await someServiceFunction()
 *   return { success: true, data: result }
 * } catch (error) {
 *   if (isServiceError(error)) {
 *     return serviceErrorToActionResult(error)
 *   }
 *   // Fall back to prisma error handling
 *   return handlePrismaError(error, { ... })
 * }
 * ```
 */
export function handleServiceLayerError(
  error: unknown,
  options: ErrorHandlingOptions,
): { success: false; error: Record<string, string[]> } | null {
  const { fallbackMessage = 'An unexpected error occurred' } = options

  // Handle ServiceError instances
  if (isServiceError(error)) {
    return serviceErrorToActionResult(error)
  }

  // Return null to indicate this handler didn't process the error
  // Caller should fall back to Prisma error handling or generic error
  return null
}
