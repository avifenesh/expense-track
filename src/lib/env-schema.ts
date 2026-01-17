import { z } from 'zod'

/**
 * Centralized environment variable validation.
 *
 * This module provides type-safe access to all environment variables used in the application.
 * Variables are validated at first access using Zod schemas, providing early failure for
 * missing or invalid configuration.
 *
 * Usage:
 * ```typescript
 * import { env } from '@/lib/env-schema'
 *
 * // Access validated env vars with type safety
 * const secret = env.jwtSecret
 * const isProd = env.isProduction
 * ```
 */

const envSchema = z.object({
  // Required - Core
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  AUTH_SESSION_SECRET: z.string().min(32, 'AUTH_SESSION_SECRET must be at least 32 characters'),

  // Environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  VITEST: z.string().optional(),

  // Paddle Payment (optional in development)
  PADDLE_API_KEY: z.string().optional(),
  PADDLE_WEBHOOK_SECRET: z.string().optional(),
  PADDLE_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_PADDLE_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),

  // Email (optional - graceful degradation when not configured)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@balancebeacon.app'),
  APP_URL: z.string().url().default('http://localhost:3000'),

  // Stock API (optional)
  ALPHA_VANTAGE_API_KEY: z.string().default(''),
  STOCK_PRICE_MAX_AGE_HOURS: z.coerce.number().default(24),

  // Sentry monitoring (optional)
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),
  SENTRY_ENABLED: z.string().optional().transform((v) => v === 'true'),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  NEXT_PUBLIC_SENTRY_ENVIRONMENT: z.string().default('development'),
  NEXT_PUBLIC_SENTRY_ENABLED: z.string().optional().transform((v) => v === 'true'),

  // Performance monitoring (optional)
  SLOW_QUERY_THRESHOLD_MS: z.coerce.number().default(1000),
  QUERY_MONITORING_ENABLED: z.string().optional().transform((v) => v !== 'false'),
})

export type Env = z.infer<typeof envSchema>

let validatedEnv: Env | null = null

/**
 * Get validated environment variables.
 * Validates on first call and caches the result.
 * Throws descriptive error if validation fails.
 */
export function getEnv(): Env {
  if (validatedEnv) {
    return validatedEnv
  }

  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    const formatted = result.error.flatten()
    const errors = Object.entries(formatted.fieldErrors)
      .map(([field, msgs]) => `  ${field}: ${msgs?.join(', ')}`)
      .join('\n')

    throw new Error(`Environment validation failed:\n${errors}`)
  }

  validatedEnv = result.data
  return validatedEnv
}

/**
 * Reset cached env (for testing purposes only)
 */
export function resetEnvCache(): void {
  validatedEnv = null
}

/**
 * Type-safe environment accessors.
 * Use these instead of accessing process.env directly.
 */
export const env = {
  // Core
  get databaseUrl() {
    return getEnv().DATABASE_URL
  },
  get jwtSecret() {
    return getEnv().JWT_SECRET
  },
  get authSessionSecret() {
    return getEnv().AUTH_SESSION_SECRET
  },

  // Environment checks
  get nodeEnv() {
    return getEnv().NODE_ENV
  },
  get isProduction() {
    return getEnv().NODE_ENV === 'production'
  },
  get isDevelopment() {
    return getEnv().NODE_ENV === 'development'
  },
  get isTest() {
    return getEnv().NODE_ENV === 'test' || getEnv().VITEST === 'true'
  },

  // Paddle
  get paddleApiKey() {
    return getEnv().PADDLE_API_KEY
  },
  get paddleWebhookSecret() {
    return getEnv().PADDLE_WEBHOOK_SECRET
  },
  get paddlePriceId() {
    return getEnv().PADDLE_PRICE_ID
  },
  get paddleEnvironment() {
    return getEnv().NEXT_PUBLIC_PADDLE_ENVIRONMENT
  },

  // Email
  get smtpHost() {
    return getEnv().SMTP_HOST
  },
  get smtpPort() {
    return getEnv().SMTP_PORT
  },
  get smtpUser() {
    return getEnv().SMTP_USER
  },
  get smtpPass() {
    return getEnv().SMTP_PASS
  },
  get smtpFrom() {
    return getEnv().SMTP_FROM
  },
  get appUrl() {
    return getEnv().APP_URL
  },
  get isEmailConfigured() {
    const e = getEnv()
    return Boolean(e.SMTP_HOST && e.SMTP_USER && e.SMTP_PASS)
  },

  // Stock API
  get alphaVantageApiKey() {
    return getEnv().ALPHA_VANTAGE_API_KEY
  },
  get stockPriceMaxAgeHours() {
    return getEnv().STOCK_PRICE_MAX_AGE_HOURS
  },

  // Monitoring
  get sentryDsn() {
    return getEnv().SENTRY_DSN
  },
  get sentryEnvironment() {
    return getEnv().SENTRY_ENVIRONMENT || getEnv().NODE_ENV
  },
  get sentryEnabled() {
    return getEnv().SENTRY_ENABLED
  },
  get slowQueryThresholdMs() {
    return getEnv().SLOW_QUERY_THRESHOLD_MS
  },
  get queryMonitoringEnabled() {
    return getEnv().QUERY_MONITORING_ENABLED
  },
}
