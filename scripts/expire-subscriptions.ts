/**
 * Expire subscriptions cron job
 *
 * This script processes expired subscriptions (trials that ended, billing periods that ended).
 * Run this daily via Railway scheduled service or cron.
 *
 * Usage: npx tsx scripts/expire-subscriptions.ts
 *
 * Railway setup:
 * 1. Create a new service in Railway
 * 2. Set build command: (none, or npm install if needed)
 * 3. Set start command: npx tsx scripts/expire-subscriptions.ts
 * 4. Set schedule: 0 0 * * * (daily at midnight UTC)
 * 5. Ensure DATABASE_URL is set in environment variables
 */

import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, SubscriptionStatus } from '@prisma/client'
import { Pool } from 'pg'

config()

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  process.stderr.write('ERROR: DATABASE_URL is not set\n')
  process.exit(1)
}

const adapter = new PrismaPg(new Pool({ connectionString: DATABASE_URL }))
const prisma = new PrismaClient({ adapter })

async function getExpiredSubscriptions(): Promise<string[]> {
  const now = new Date()

  const expiredTrials = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.TRIALING,
      trialEndsAt: { lt: now },
    },
    select: { userId: true },
  })

  const expiredPeriods = await prisma.subscription.findMany({
    where: {
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.CANCELED] },
      currentPeriodEnd: { lt: now },
    },
    select: { userId: true },
  })

  return [...expiredTrials, ...expiredPeriods].map((s) => s.userId)
}

async function processExpiredSubscriptions(): Promise<number> {
  const expiredUserIds = await getExpiredSubscriptions()

  if (expiredUserIds.length === 0) {
    return 0
  }

  await prisma.subscription.updateMany({
    where: { userId: { in: expiredUserIds } },
    data: { status: SubscriptionStatus.EXPIRED },
  })

  return expiredUserIds.length
}

async function main() {
  const timestamp = new Date().toISOString()
  process.stdout.write(`[${timestamp}] Starting subscription expiration job...\n`)

  try {
    const expiredCount = await processExpiredSubscriptions()

    if (expiredCount === 0) {
      process.stdout.write(`[${timestamp}] No subscriptions to expire.\n`)
    } else {
      process.stdout.write(`[${timestamp}] Expired ${expiredCount} subscription(s).\n`)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[${timestamp}] ERROR: Failed to process expired subscriptions: ${errorMessage}\n`)
    throw error
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
    process.exit(0)
  })
  .catch(async (e) => {
    process.stderr.write(`Fatal error: ${e}\n`)
    await prisma.$disconnect()
    process.exit(1)
  })
