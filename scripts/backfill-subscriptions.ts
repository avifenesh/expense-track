/**
 * Backfill subscriptions for existing users
 *
 * This script creates trial subscriptions for all existing users who don't have one.
 * Run this after deploying the subscription model to production.
 *
 * Usage: npx tsx scripts/backfill-subscriptions.ts
 */

import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, SubscriptionStatus } from '@prisma/client'
import { Pool } from 'pg'

config()

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg(new Pool({ connectionString: DATABASE_URL }))
const prisma = new PrismaClient({ adapter })

const TRIAL_DURATION_DAYS = 14

async function main() {
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS)

  // Find all users without subscriptions
  const usersWithoutSubscription = await prisma.user.findMany({
    where: {
      subscription: null,
    },
    select: {
      id: true,
      email: true,
    },
  })

  if (usersWithoutSubscription.length === 0) {
    process.stdout.write('All users already have subscriptions. Nothing to do.\n')
    return
  }

  process.stdout.write(`Found ${usersWithoutSubscription.length} users without subscriptions.\n`)

  // Create trial subscriptions for all users without one
  const results = await Promise.allSettled(
    usersWithoutSubscription.map((user) =>
      prisma.subscription.create({
        data: {
          userId: user.id,
          status: SubscriptionStatus.TRIALING,
          trialEndsAt,
        },
      }),
    ),
  )

  const successful = results.filter((r) => r.status === 'fulfilled').length
  const failed = results.filter((r) => r.status === 'rejected').length

  process.stdout.write(`Created ${successful} trial subscriptions.\n`)
  if (failed > 0) {
    process.stdout.write(`Failed to create ${failed} subscriptions.\n`)
    const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[]
    for (const failure of failures) {
      process.stderr.write(`Error: ${failure.reason}\n`)
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    process.stderr.write(`Fatal error: ${e}\n`)
    await prisma.$disconnect()
    process.exit(1)
  })
