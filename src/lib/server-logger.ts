/**
 * Server-side logger for error handling with context.
 * Logs errors with structured data for debugging while preventing
 * stack traces and sensitive info from leaking to clients.
 */

/* eslint-disable no-console -- This is the designated logging module */

type LogLevel = 'error' | 'warn' | 'info'

interface LogContext {
  action?: string
  userId?: string
  accountId?: string
  input?: Record<string, unknown>
  [key: string]: unknown
}

interface LogEntry {
  level: LogLevel
  message: string
  context: LogContext
  error?: {
    name: string
    message: string
    code?: string
    stack?: string
  }
  timestamp: string
}

function sanitizeInput(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== 'object') return undefined

  const sanitized: Record<string, unknown> = {}
  const sensitiveKeys = ['password', 'token', 'secret', 'csrfToken', 'apiKey', 'authorization']

  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeInput(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

function formatError(error: unknown): LogEntry['error'] | undefined {
  if (!error) return undefined

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: (error as Error & { code?: string }).code,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }
  }

  return {
    name: 'UnknownError',
    message: String(error),
  }
}

function log(level: LogLevel, message: string, context: LogContext, error?: unknown): void {
  const entry: LogEntry = {
    level,
    message,
    context: {
      ...context,
      input: context.input ? sanitizeInput(context.input) : undefined,
    },
    error: formatError(error),
    timestamp: new Date().toISOString(),
  }

  // In production, this would send to a logging service (e.g., Datadog, Sentry)
  // For now, use structured JSON logging that can be parsed by log aggregators
  const logMethod = level === 'error' ? console.error : level === 'warn' ? console.warn : console.info

  // Use JSON format for structured logging in production
  if (process.env.NODE_ENV === 'production') {
    logMethod(JSON.stringify(entry))
  } else {
    // More readable format for development
    logMethod(`[${entry.level.toUpperCase()}] ${entry.message}`, {
      ...entry.context,
      error: entry.error,
    })
  }
}

export const serverLogger = {
  error: (message: string, context: LogContext, error?: unknown) => log('error', message, context, error),
  warn: (message: string, context: LogContext, error?: unknown) => log('warn', message, context, error),
  info: (message: string, context: LogContext) => log('info', message, context),
}
