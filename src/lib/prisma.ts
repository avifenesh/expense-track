import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as Sentry from '@sentry/nextjs'
import { SLOW_QUERY_THRESHOLD_MS, QUERY_MONITORING_ENABLED, sanitizeArgs } from './monitoring/prisma-monitor'

declare global {
  var prisma: PrismaClient | undefined
  var prismaPool: Pool | undefined
}

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const pool = global.prismaPool ?? new Pool({ connectionString: DATABASE_URL })
const adapter = new PrismaPg(pool)

const basePrisma = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

// Apply query monitoring extension
export const prisma =
  global.prisma ??
  basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ operation, model, args, query }) {
          if (!QUERY_MONITORING_ENABLED) {
            return query(args)
          }

          const before = Date.now()

          try {
            const result = await query(args)
            const duration = Date.now() - before

            // Log slow queries
            if (duration > SLOW_QUERY_THRESHOLD_MS) {
              const logData = {
                model,
                action: operation,
                duration,
                timestamp: new Date().toISOString(),
                threshold: SLOW_QUERY_THRESHOLD_MS,
                args: sanitizeArgs(args),
              }

              // Structured log for Vercel/production systems
              // eslint-disable-next-line no-console
              console.warn('SLOW_QUERY', JSON.stringify(logData))

              // Report to Sentry as breadcrumb
              Sentry.addBreadcrumb({
                category: 'database.slow_query',
                message: `Slow query: ${model}.${operation}`,
                level: 'warning',
                data: {
                  duration,
                  model,
                  action: operation,
                  threshold: SLOW_QUERY_THRESHOLD_MS,
                },
              })

              // Critical threshold: 5x the slow query threshold
              if (duration > SLOW_QUERY_THRESHOLD_MS * 5) {
                Sentry.captureMessage(`Critical slow query: ${model}.${operation} (${duration}ms)`, {
                  level: 'warning',
                  extra: logData,
                })
              }
            }

            return result
          } catch (error) {
            const duration = Date.now() - before

            // Log query errors with timing
            // eslint-disable-next-line no-console
            console.error(
              'QUERY_ERROR',
              JSON.stringify({
                model,
                action: operation,
                duration,
                error: error instanceof Error ? error.message : String(error),
              }),
            )

            throw error
          }
        },
      },
    },
  })

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
  global.prismaPool = pool
}
