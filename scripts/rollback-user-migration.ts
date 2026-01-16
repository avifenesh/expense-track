/**
 * Rollback user migration
 *
 * This script reverses the changes made by migrate-to-user-model.ts using the
 * saved migration state.
 *
 * WHAT IT DOES:
 * 1. Reads migration state from .migration-state.json
 * 2. Reverts account ownership back to 'legacy-user'
 * 3. Reverts category ownership back to 'legacy-user'
 * 4. Deletes subscriptions created by the migration
 * 5. Optionally deletes User records created by the migration
 *
 * PREREQUISITES:
 * - DATABASE_URL environment variable set
 * - .migration-state.json exists (created by migrate-to-user-model.ts)
 *
 * Usage: npx tsx scripts/rollback-user-migration.ts
 *        npm run rollback:users
 *
 * Options:
 *   --delete-users  Also delete User records created by migration
 */

import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

config()

const DATABASE_URL = process.env.DATABASE_URL
const STATE_FILE = path.join(__dirname, '.migration-state.json')

if (!DATABASE_URL) {
  process.stderr.write('Error: DATABASE_URL is not set\n')
  process.exit(1)
}

const adapter = new PrismaPg(new Pool({ connectionString: DATABASE_URL }))
const prisma = new PrismaClient({ adapter })

interface MigrationState {
  migratedAt: string
  accounts: Array<{ id: string; originalUserId: string; newUserId: string }>
  categories: Array<{ id: string; originalUserId: string; newUserId: string }>
  createdUserIds: string[]
  createdSubscriptionUserIds: string[]
}

/**
 * Load migration state from file
 */
function loadMigrationState(): MigrationState | null {
  if (!fs.existsSync(STATE_FILE)) {
    return null
  }
  const content = fs.readFileSync(STATE_FILE, 'utf-8')
  return JSON.parse(content) as MigrationState
}

/**
 * Delete migration state file
 */
function deleteMigrationState(): void {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE)
    process.stdout.write(`Deleted migration state file: ${STATE_FILE}\n`)
  }
}

async function main() {
  const deleteUsers = process.argv.includes('--delete-users')

  process.stdout.write('Starting rollback of user migration...\n\n')

  // Load migration state
  const state = loadMigrationState()
  if (!state) {
    process.stderr.write('Error: No migration state found.\n')
    process.stderr.write(`Expected file: ${STATE_FILE}\n`)
    process.stderr.write('Cannot rollback without migration state.\n')
    process.exit(1)
  }

  process.stdout.write(`Migration state from: ${state.migratedAt}\n`)
  process.stdout.write(`  Accounts to revert: ${state.accounts.length}\n`)
  process.stdout.write(`  Categories to revert: ${state.categories.length}\n`)
  process.stdout.write(`  Subscriptions to delete: ${state.createdSubscriptionUserIds.length}\n`)
  if (deleteUsers) {
    process.stdout.write(`  Users to delete: ${state.createdUserIds.length}\n`)
  }
  process.stdout.write('\n')

  // Execute rollback in a transaction
  process.stdout.write('Step 1: Reverting data ownership...\n')

  await prisma.$transaction(async (tx) => {
    // Revert account ownership
    for (const account of state.accounts) {
      try {
        await tx.account.update({
          where: { id: account.id },
          data: { userId: account.originalUserId },
        })
      } catch {
        process.stdout.write(`  Warning: Account ${account.id} not found (may have been deleted)\n`)
      }
    }
    process.stdout.write(`  Reverted ${state.accounts.length} account(s)\n`)

    // Revert category ownership
    for (const category of state.categories) {
      try {
        await tx.category.update({
          where: { id: category.id },
          data: { userId: category.originalUserId },
        })
      } catch {
        process.stdout.write(`  Warning: Category ${category.id} not found (may have been deleted)\n`)
      }
    }
    process.stdout.write(`  Reverted ${state.categories.length} category(ies)\n`)
  })
  process.stdout.write('\n')

  // Delete subscriptions created by migration
  process.stdout.write('Step 2: Deleting subscriptions created by migration...\n')
  let deletedSubscriptions = 0
  for (const userId of state.createdSubscriptionUserIds) {
    try {
      await prisma.subscription.delete({
        where: { userId },
      })
      deletedSubscriptions++
    } catch {
      process.stdout.write(`  Warning: Subscription for user ${userId} not found\n`)
    }
  }
  process.stdout.write(`  Deleted ${deletedSubscriptions} subscription(s)\n\n`)

  // Optionally delete users created by migration
  if (deleteUsers && state.createdUserIds.length > 0) {
    process.stdout.write('Step 3: Deleting users created by migration...\n')
    let deletedUsers = 0
    for (const userId of state.createdUserIds) {
      try {
        // Check if user still exists and has no other data
        const user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            accounts: true,
            categories: true,
            refreshTokens: true,
          },
        })

        if (user) {
          // Only delete if user has no accounts/categories (they should have been reverted)
          if (user.accounts.length === 0 && user.categories.length === 0) {
            await prisma.user.delete({ where: { id: userId } })
            deletedUsers++
            process.stdout.write(`  Deleted user: ${user.email}\n`)
          } else {
            process.stdout.write(`  Skipped user ${user.email} (still has associated data)\n`)
          }
        }
      } catch {
        process.stdout.write(`  Warning: User ${userId} not found\n`)
      }
    }
    process.stdout.write(`  Deleted ${deletedUsers} user(s)\n\n`)
  } else if (state.createdUserIds.length > 0) {
    process.stdout.write('Step 3: Skipping user deletion (use --delete-users flag to delete)\n')
    process.stdout.write(`  ${state.createdUserIds.length} user(s) preserved\n\n`)
  }

  // Delete migration state file
  deleteMigrationState()

  // Summary
  process.stdout.write('='.repeat(50) + '\n')
  process.stdout.write('Rollback completed successfully!\n')
  process.stdout.write('='.repeat(50) + '\n')
  process.stdout.write(`  Accounts reverted: ${state.accounts.length}\n`)
  process.stdout.write(`  Categories reverted: ${state.categories.length}\n`)
  process.stdout.write(`  Subscriptions deleted: ${deletedSubscriptions}\n`)
  if (deleteUsers) {
    process.stdout.write(`  Users deleted: ${state.createdUserIds.length}\n`)
  }
  process.stdout.write('\nData has been restored to legacy-user ownership.\n')
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
