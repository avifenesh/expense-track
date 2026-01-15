/**
 * Prisma error handling utilities.
 * Maps Prisma-specific errors to user-friendly messages.
 */

import { failure, generalError, type ActionResult } from './action-result'
import { serverLogger } from './server-logger'

// Prisma error codes
// https://www.prisma.io/docs/reference/api-reference/error-reference
const PRISMA_ERROR_CODES = {
  UNIQUE_CONSTRAINT: 'P2002',
  FOREIGN_KEY_CONSTRAINT: 'P2003',
  RECORD_NOT_FOUND: 'P2025',
  REQUIRED_RELATION_VIOLATION: 'P2014',
  INVALID_DATA: 'P2000',
} as const

interface ErrorMappingOptions {
  /** Action name for logging context */
  action: string
  /** User ID for logging context */
  userId?: string
  /** Account ID for logging context */
  accountId?: string
  /** Input data (will be sanitized before logging) */
  input?: unknown
  /** Custom message for unique constraint violations */
  uniqueMessage?: string
  /** Custom message for not found errors */
  notFoundMessage?: string
  /** Custom message for foreign key violations */
  foreignKeyMessage?: string
  /** Generic fallback message */
  fallbackMessage?: string
}

/**
 * Type guard for Prisma known request errors.
 * Uses duck typing to avoid instanceof issues in test environments.
 */
function isPrismaKnownRequestError(error: unknown): error is {
  code: string
  meta?: { target?: string[] | string }
  name: string
  message: string
} {
  return (
    error !== null &&
    typeof error === 'object' &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string' &&
    (error as { code: string }).code.startsWith('P') &&
    'name' in error &&
    (error as { name: string }).name === 'PrismaClientKnownRequestError'
  )
}

/**
 * Type guard for Prisma validation errors.
 */
function isPrismaValidationError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name: string }).name === 'PrismaClientValidationError'
  )
}

/**
 * Type guard for Prisma initialization errors.
 */
function isPrismaInitializationError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name: string }).name === 'PrismaClientInitializationError'
  )
}

/**
 * Type guard for Prisma panic errors.
 */
function isPrismaPanicError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name: string }).name === 'PrismaClientRustPanicError'
  )
}

/**
 * Maps a Prisma error to a user-friendly ActionResult.
 * Logs the full error server-side while returning safe messages to client.
 */
export function handlePrismaError(error: unknown, options: ErrorMappingOptions): ActionResult<never> {
  const {
    action,
    userId,
    accountId,
    input,
    uniqueMessage = 'This record already exists',
    notFoundMessage = 'Record not found',
    foreignKeyMessage = 'This operation references data that no longer exists',
    fallbackMessage = 'An unexpected error occurred. Please try again.',
  } = options

  const logContext = {
    action,
    userId,
    accountId,
    input: input as Record<string, unknown>,
  }

  // Handle Prisma-specific errors using duck typing
  if (isPrismaKnownRequestError(error)) {
    serverLogger.warn(`Prisma error in ${action}`, { ...logContext, prismaCode: error.code }, error)

    switch (error.code) {
      case PRISMA_ERROR_CODES.UNIQUE_CONSTRAINT: {
        // Extract the field(s) that caused the violation if available
        const target = error.meta?.target

        if (Array.isArray(target) && target.length > 0) {
          // Handle single-field and compound unique constraints
          const fieldErrors: Record<string, string[]> = {}
          for (const fieldName of target) {
            if (typeof fieldName === 'string' && fieldName.length > 0) {
              fieldErrors[fieldName] = [uniqueMessage]
            }
          }

          if (Object.keys(fieldErrors).length > 0) {
            return failure(fieldErrors)
          }
        } else if (typeof target === 'string' && target.length > 0) {
          // Some Prisma versions may provide a single string instead of an array
          return failure({ [target]: [uniqueMessage] })
        }
        return generalError(uniqueMessage)
      }

      case PRISMA_ERROR_CODES.RECORD_NOT_FOUND:
        return generalError(notFoundMessage)

      case PRISMA_ERROR_CODES.FOREIGN_KEY_CONSTRAINT:
        return generalError(foreignKeyMessage)

      case PRISMA_ERROR_CODES.REQUIRED_RELATION_VIOLATION:
        return generalError('Cannot complete this operation due to existing related data')

      case PRISMA_ERROR_CODES.INVALID_DATA:
        return generalError('Invalid data provided')

      default:
        serverLogger.error(`Unhandled Prisma error code in ${action}`, logContext, error)
        return generalError(fallbackMessage)
    }
  }

  // Handle Prisma validation errors
  if (isPrismaValidationError(error)) {
    serverLogger.error(`Prisma validation error in ${action}`, logContext, error)
    return generalError('Invalid data format')
  }

  // Handle connection errors
  if (isPrismaInitializationError(error)) {
    serverLogger.error(`Database connection error in ${action}`, logContext, error)
    return generalError('Service temporarily unavailable. Please try again later.')
  }

  // Handle panic errors
  if (isPrismaPanicError(error)) {
    serverLogger.error(`Critical database error in ${action}`, logContext, error)
    return generalError('Service error. Please try again later.')
  }

  // Handle generic errors
  if (error instanceof Error) {
    serverLogger.error(`Unexpected error in ${action}`, logContext, error)
    return generalError(fallbackMessage)
  }

  // Unknown error type
  serverLogger.error(`Unknown error type in ${action}`, logContext, error)
  return generalError(fallbackMessage)
}

/**
 * Wraps an async operation with error handling.
 * Use this for database operations that might fail.
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  options: ErrorMappingOptions,
): Promise<{ data: T } | ActionResult<never>> {
  try {
    const data = await operation()
    return { data }
  } catch (error) {
    return handlePrismaError(error, options)
  }
}
