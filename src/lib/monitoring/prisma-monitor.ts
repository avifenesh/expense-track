import 'server-only'
import * as Sentry from '@sentry/nextjs'

const SLOW_QUERY_THRESHOLD_MS = parseInt(
  process.env.SLOW_QUERY_THRESHOLD_MS || '1000',
  10
)
const QUERY_MONITORING_ENABLED = process.env.QUERY_MONITORING_ENABLED !== 'false'

interface QueryMetrics {
  model?: string
  action?: string
  duration: number
  timestamp: string
}

interface MiddlewareParams {
  model?: string
  action: string
  args: unknown
}

/**
 * Prisma middleware for query performance monitoring.
 *
 * Tracks query execution time and logs slow queries.
 * Integrates with Sentry for alerting on performance issues.
 */
export const queryMonitorMiddleware = async (params: MiddlewareParams, next: (params: MiddlewareParams) => Promise<unknown>): Promise<unknown> => {
  if (!QUERY_MONITORING_ENABLED) {
    return next(params)
  }

  const before = Date.now()

  try {
    const result = await next(params)
    const duration = Date.now() - before

    const metrics: QueryMetrics = {
      model: params.model,
      action: params.action,
      duration,
      timestamp: new Date().toISOString(),
    }

    // Log slow queries
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      const logData = {
        ...metrics,
        threshold: SLOW_QUERY_THRESHOLD_MS,
        args: sanitizeArgs(params.args),
      }

      // Structured log for Vercel/production systems
      // eslint-disable-next-line no-console
      console.warn('SLOW_QUERY', JSON.stringify(logData))

      // Report to Sentry as breadcrumb
      Sentry?.addBreadcrumb({
        category: 'database.slow_query',
        message: `Slow query: ${params.model}.${params.action}`,
        level: 'warning',
        data: {
          duration,
          model: params.model,
          action: params.action,
          threshold: SLOW_QUERY_THRESHOLD_MS,
        },
      })

      // Critical threshold: 5x the slow query threshold
      if (duration > SLOW_QUERY_THRESHOLD_MS * 5) {
        Sentry?.captureMessage(
          `Critical slow query: ${params.model}.${params.action} (${duration}ms)`,
          {
            level: 'warning',
            extra: logData,
          }
        )
      }
    }

    return result
  } catch (error) {
    const duration = Date.now() - before

    // Log query errors with timing
    // eslint-disable-next-line no-console
    console.error('QUERY_ERROR', JSON.stringify({
      model: params.model,
      action: params.action,
      duration,
      error: error instanceof Error ? error.message : String(error),
    }))

    throw error
  }
}

/**
 * Sanitize query arguments to remove sensitive data.
 * Removes password hashes and other sensitive fields.
 */
function sanitizeArgs(args: unknown): unknown {
  if (!args || typeof args !== 'object') {
    return args
  }

  const sanitized = { ...args } as Record<string, unknown>

  // Remove sensitive fields
  const sensitiveFields = ['passwordHash', 'password', 'token', 'secret']
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]'
    }
  }

  // Handle nested data objects
  if ('data' in sanitized && typeof sanitized.data === 'object' && sanitized.data !== null) {
    sanitized.data = sanitizeArgs(sanitized.data)
  }

  return sanitized
}
