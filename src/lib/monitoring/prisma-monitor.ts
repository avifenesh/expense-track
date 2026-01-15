import 'server-only'

export const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000', 10)
export const QUERY_MONITORING_ENABLED = process.env.QUERY_MONITORING_ENABLED !== 'false'

/**
 * Sanitize query arguments to remove sensitive data.
 * Recursively removes password hashes and other sensitive fields.
 */
export function sanitizeArgs(args: unknown): unknown {
  if (typeof args !== 'object' || args === null) {
    return args
  }

  if (Array.isArray(args)) {
    return args.map(sanitizeArgs)
  }

  const sensitiveFields = new Set(['passwordHash', 'password', 'token', 'secret'])
  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(args)) {
    if (sensitiveFields.has(key)) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeArgs(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}
