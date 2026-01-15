import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
// import { queryMonitorMiddleware } from './monitoring/prisma-monitor'

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

export const prisma =
  global.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// TODO: Add query monitoring middleware
// Prisma $use middleware is deprecated and not available with adapter pattern
// Alternative: Use Prisma query logging or wrap Prisma client methods
// prisma.$use(queryMonitorMiddleware)

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma
  global.prismaPool = pool
}
