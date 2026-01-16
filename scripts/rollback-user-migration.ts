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
import { Prisma, PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'

config()

const DATABASE_URL = process.env.DATABASE_URL
const STATE_FILE = path.join(__dirname, '.migration-state.json')
const PARTIAL_STATE_FILE = path.join(__dirname, '.migration-state.partial.json')

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

/**
 * Rename state file to indicate partial rollback
 */
function markStateAsPartial(): void {
  if (fs.existsSync(STATE_FILE)) {
    fs.renameSync(STATE_FILE, PARTIAL_STATE_FILE)
    process.stdout.write(`Renamed state file to: ${PARTIAL_STATE_FILE}\n`)
  }
}

/**
 * Check if an error is a "record not found" error (P2025)
 */
function isRecordNotFoundError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
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

  // Execute rollback in a transaction - all data changes are atomic
  process.stdout.write('Reverting data ownership and subscriptions...\n')

  let revertedAccounts = 0
  let revertedCategories = 0
  let deletedSubscriptions = 0

  try {
    await prisma.$transaction(async (tx) => {
      // Revert account ownership in parallel for better performance
      const accountPromises = state.accounts.map(async (account) => {
        try {
          await tx.account.update({
            where: { id: account.id },
            data: { userId: account.originalUserId },
          })
          return true
        } catch (error) {
          if (isRecordNotFoundError(error)) {
            process.stdout.write(`  Warning: Account ${account.id} not found (may have been deleted)\n`)
            return false
          }
          throw error // Re-throw to rollback transaction
        }
      })
      const accountResults = await Promise.all(accountPromises)
      revertedAccounts = accountResults.filter(Boolean).length
      process.stdout.write(`  Reverted ${revertedAccounts} account(s)\n`)

      // Revert category ownership in parallel
      const categoryPromises = state.categories.map(async (category) => {
        try {
          await tx.category.update({
            where: { id: category.id },
            data: { userId: category.originalUserId },
          })
          return true
        } catch (error) {
          if (isRecordNotFoundError(error)) {
            process.stdout.write(`  Warning: Category ${category.id} not found (may have been deleted)\n`)
            return false
          }
          throw error // Re-throw to rollback transaction
        }
      })
      const categoryResults = await Promise.all(categoryPromises)
      revertedCategories = categoryResults.filter(Boolean).length
      process.stdout.write(`  Reverted ${revertedCategories} category(ies)\n`)

      // Delete subscriptions in parallel within the same transaction
      const subscriptionPromises = state.createdSubscriptionUserIds.map(async (userId) => {
        try {
          await tx.subscription.delete({
            where: { userId },
          })
          return true
        } catch (error) {
          if (isRecordNotFoundError(error)) {
            process.stdout.write(`  Warning: Subscription for user ${userId} not found\n`)
            return false
          }
          throw error // Re-throw to rollback transaction
        }
      })
      const subscriptionResults = await Promise.all(subscriptionPromises)
      deletedSubscriptions = subscriptionResults.filter(Boolean).length
      process.stdout.write(`  Deleted ${deletedSubscriptions} subscription(s)\n`)
    })
  } catch (error) {
    process.stderr.write(`\nError during rollback transaction: ${error}\n`)
    process.stderr.write('Transaction rolled back. Original state preserved.\n')
    markStateAsPartial()
    throw error
  }
  process.stdout.write('\n')

  // Optionally delete users created by migration
  let deletedUsers = 0
  if (deleteUsers && state.createdUserIds.length > 0) {
    process.stdout.write('Deleting users created by migration...\n')
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
    process.stdout.write('Skipping user deletion (use --delete-users flag to delete)\n')
    process.stdout.write(`  ${state.createdUserIds.length} user(s) preserved\n\n`)
  }

  // If we got here, rollback succeeded - delete migration state file
  deleteMigrationState()

  // Summary
  process.stdout.write('='.repeat(50) + '\n')
  process.stdout.write('Rollback completed successfully!\n')
  process.stdout.write('='.repeat(50) + '\n')
  process.stdout.write(`  Accounts reverted: ${revertedAccounts}\n`)
  process.stdout.write(`  Categories reverted: ${revertedCategories}\n`)
  process.stdout.write(`  Subscriptions deleted: ${deletedSubscriptions}\n`)
  if (deleteUsers) {
    process.stdout.write(`  Users deleted: ${deletedUsers}\n`)
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
