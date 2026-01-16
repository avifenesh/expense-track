/**
 * Migrate existing data to user-based model
 *
 * This script migrates production data from the 'legacy-user' placeholder to actual
 * user accounts defined via AUTH_USER*_* environment variables.
 *
 * WHAT IT DOES:
 * 1. Creates User records from AUTH_USER1_* and AUTH_USER2_* env vars
 * 2. Matches existing accounts to users by name === displayName
 * 3. Transfers account ownership from 'legacy-user' to matched users
 * 4. Transfers all categories to the primary user (user1)
 * 5. Creates trial subscriptions for migrated users
 * 6. Stores migration state for rollback capability
 *
 * PREREQUISITES:
 * - DATABASE_URL environment variable set
 * - AUTH_USER1_* environment variables set (required)
 * - AUTH_USER2_* environment variables set (optional)
 *
 * Usage: npx tsx scripts/migrate-to-user-model.ts
 *        npm run migrate:users
 */

import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { Currency, PrismaClient, SubscriptionStatus } from '@prisma/client'
import { Pool } from 'pg'
import * as fs from 'fs'
import * as path from 'path'
import { TRIAL_DURATION_DAYS } from '../src/lib/subscription-constants'

config()

const DATABASE_URL = process.env.DATABASE_URL
const LEGACY_USER_ID = 'legacy-user'
const STATE_FILE = path.join(__dirname, '.migration-state.json')
const VALID_CURRENCIES = Object.values(Currency)

if (!DATABASE_URL) {
  process.stderr.write('Error: DATABASE_URL is not set\n')
  process.exit(1)
}

const adapter = new PrismaPg(new Pool({ connectionString: DATABASE_URL }))
const prisma = new PrismaClient({ adapter })

interface MigrationUser {
  email: string
  displayName: string
  passwordHash: string
  preferredCurrency: Currency
}

interface MigrationState {
  migratedAt: string
  accounts: Array<{ id: string; originalUserId: string; newUserId: string }>
  categories: Array<{ id: string; originalUserId: string; newUserId: string }>
  createdUserIds: string[]
  createdSubscriptionUserIds: string[]
}

/**
 * Validate and parse currency from environment variable
 */
function parseCurrency(value: string | undefined): Currency {
  const trimmed = value?.trim()
  if (trimmed && VALID_CURRENCIES.includes(trimmed as Currency)) {
    return trimmed as Currency
  }
  return Currency.USD
}

/**
 * Parse user data from environment variables
 * User 1 is required, User 2 is optional
 */
function parseUserEnvVars(): MigrationUser[] {
  const users: MigrationUser[] = []

  // Parse user 1 (required)
  const user1Email = process.env.AUTH_USER1_EMAIL?.trim()
  const user1DisplayName = process.env.AUTH_USER1_DISPLAY_NAME?.trim()
  const user1PasswordHashRaw = process.env.AUTH_USER1_PASSWORD_HASH?.trim().replace(/^["']|["']$/g, '')
  const user1PasswordHash = user1PasswordHashRaw?.replace(/\\\$/g, '$')
  const user1PreferredCurrency = parseCurrency(process.env.AUTH_USER1_PREFERRED_CURRENCY)

  if (!user1Email || !user1DisplayName || !user1PasswordHash) {
    throw new Error(
      'Missing required environment variables for user 1 (AUTH_USER1_EMAIL, AUTH_USER1_DISPLAY_NAME, AUTH_USER1_PASSWORD_HASH)',
    )
  }

  users.push({
    email: user1Email,
    displayName: user1DisplayName,
    passwordHash: user1PasswordHash,
    preferredCurrency: user1PreferredCurrency,
  })

  // Parse user 2 (optional)
  const user2Email = process.env.AUTH_USER2_EMAIL?.trim()
  const user2DisplayName = process.env.AUTH_USER2_DISPLAY_NAME?.trim()
  const user2PasswordHashRaw = process.env.AUTH_USER2_PASSWORD_HASH?.trim().replace(/^["']|["']$/g, '')
  const user2PasswordHash = user2PasswordHashRaw?.replace(/\\\$/g, '$')
  const user2PreferredCurrency = parseCurrency(process.env.AUTH_USER2_PREFERRED_CURRENCY)

  if (user2Email && user2DisplayName && user2PasswordHash) {
    users.push({
      email: user2Email,
      displayName: user2DisplayName,
      passwordHash: user2PasswordHash,
      preferredCurrency: user2PreferredCurrency,
    })
  }

  return users
}

/**
 * Save migration state for rollback capability
 */
function saveMigrationState(state: MigrationState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
  process.stdout.write(`Migration state saved to ${STATE_FILE}\n`)
}

/**
 * Check if migration state exists (indicates previous migration)
 */
function migrationStateExists(): boolean {
  return fs.existsSync(STATE_FILE)
}

async function main() {
  process.stdout.write('Starting migration to user-based model...\n\n')

  // Check for existing migration state
  if (migrationStateExists()) {
    process.stdout.write('Warning: Previous migration state found. Run rollback first if needed.\n')
    process.stdout.write('Continuing will overwrite the previous state.\n\n')
  }

  // Parse users from environment
  const migrationUsers = parseUserEnvVars()
  process.stdout.write(`Found ${migrationUsers.length} users to migrate:\n`)
  migrationUsers.forEach((u, i) => {
    process.stdout.write(`  User ${i + 1}: ${u.email} (${u.displayName})\n`)
  })
  process.stdout.write('\n')

  // Initialize migration state
  const migrationState: MigrationState = {
    migratedAt: new Date().toISOString(),
    accounts: [],
    categories: [],
    createdUserIds: [],
    createdSubscriptionUserIds: [],
  }

  // Step 1: Create/upsert User records
  process.stdout.write('Step 1: Creating user records...\n')
  const createdUsers = await Promise.all(
    migrationUsers.map(async (userData) => {
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      })

      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {
          displayName: userData.displayName,
          passwordHash: userData.passwordHash,
          preferredCurrency: userData.preferredCurrency,
          // Don't update emailVerified or hasCompletedOnboarding for existing users
        },
        create: {
          email: userData.email,
          displayName: userData.displayName,
          passwordHash: userData.passwordHash,
          preferredCurrency: userData.preferredCurrency,
          emailVerified: true, // Production users, not new registrations
          hasCompletedOnboarding: true, // They know the app
        },
      })

      if (!existingUser) {
        migrationState.createdUserIds.push(user.id)
        process.stdout.write(`  Created user: ${user.email} (${user.id})\n`)
      } else {
        process.stdout.write(`  Updated existing user: ${user.email} (${user.id})\n`)
      }

      return user
    }),
  )
  process.stdout.write('\n')

  // Build lookup map: displayName -> user
  const userByDisplayName = new Map(createdUsers.map((u) => [u.displayName, u]))

  // Step 2: Find accounts owned by legacy-user
  process.stdout.write('Step 2: Finding legacy accounts...\n')
  const legacyAccounts = await prisma.account.findMany({
    where: { userId: LEGACY_USER_ID },
  })

  if (legacyAccounts.length === 0) {
    process.stdout.write('  No legacy accounts found. Migration may have already run.\n\n')
  } else {
    process.stdout.write(`  Found ${legacyAccounts.length} legacy accounts\n\n`)
  }

  // Step 3: Match accounts to users
  process.stdout.write('Step 3: Matching accounts to users...\n')
  const accountMappings: Array<{ accountId: string; newUserId: string }> = []
  const unmatchedAccounts: string[] = []

  for (const account of legacyAccounts) {
    const matchedUser = userByDisplayName.get(account.name)
    if (matchedUser) {
      accountMappings.push({ accountId: account.id, newUserId: matchedUser.id })
      process.stdout.write(`  Account "${account.name}" -> User "${matchedUser.email}"\n`)
      migrationState.accounts.push({
        id: account.id,
        originalUserId: LEGACY_USER_ID,
        newUserId: matchedUser.id,
      })
    } else {
      unmatchedAccounts.push(account.name)
    }
  }

  if (unmatchedAccounts.length > 0) {
    process.stderr.write(`\nError: ${unmatchedAccounts.length} accounts could not be matched:\n`)
    unmatchedAccounts.forEach((name) => {
      process.stderr.write(`  - "${name}"\n`)
    })
    process.stderr.write('\nAccount names must match user displayNames.\n')
    process.stderr.write('Check AUTH_USER*_DISPLAY_NAME environment variables.\n')
    process.exit(1)
  }
  process.stdout.write('\n')

  // Step 4: Find categories owned by legacy-user
  process.stdout.write('Step 4: Finding legacy categories...\n')
  const legacyCategories = await prisma.category.findMany({
    where: { userId: LEGACY_USER_ID },
  })

  if (legacyCategories.length === 0) {
    process.stdout.write('  No legacy categories found.\n\n')
  } else {
    process.stdout.write(`  Found ${legacyCategories.length} legacy categories\n`)
    // Assign all categories to primary user (user1)
    const primaryUser = createdUsers[0]
    for (const category of legacyCategories) {
      migrationState.categories.push({
        id: category.id,
        originalUserId: LEGACY_USER_ID,
        newUserId: primaryUser.id,
      })
    }
    process.stdout.write(`  Will assign all to primary user: ${primaryUser.email}\n\n`)
  }

  // Pre-compute which users need subscriptions (before transaction)
  process.stdout.write('Step 5: Checking existing subscriptions...\n')
  const usersNeedingSubscription: typeof createdUsers = []
  for (const user of createdUsers) {
    const existingSubscription = await prisma.subscription.findUnique({
      where: { userId: user.id },
    })
    if (!existingSubscription) {
      usersNeedingSubscription.push(user)
      migrationState.createdSubscriptionUserIds.push(user.id)
    } else {
      process.stdout.write(`  Subscription already exists for ${user.email}\n`)
    }
  }
  process.stdout.write('\n')

  // Save migration state BEFORE the transaction so we can rollback if needed
  saveMigrationState(migrationState)

  // Step 6: Execute all changes in a single transaction for atomicity
  process.stdout.write('Step 6: Executing migration transaction...\n')
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS)

  await prisma.$transaction(async (tx) => {
    // Update account ownership in parallel for better performance
    await Promise.all(
      accountMappings.map((mapping) =>
        tx.account.update({
          where: { id: mapping.accountId },
          data: { userId: mapping.newUserId },
        }),
      ),
    )
    process.stdout.write(`  Updated ${accountMappings.length} account(s)\n`)

    // Update category ownership (all to primary user)
    if (legacyCategories.length > 0) {
      const primaryUser = createdUsers[0]
      await tx.category.updateMany({
        where: { userId: LEGACY_USER_ID },
        data: { userId: primaryUser.id },
      })
      process.stdout.write(`  Updated ${legacyCategories.length} category(ies)\n`)
    }

    // Create subscriptions in parallel within the same transaction
    await Promise.all(
      usersNeedingSubscription.map((user) =>
        tx.subscription.create({
          data: {
            userId: user.id,
            status: SubscriptionStatus.TRIALING,
            trialEndsAt,
          },
        }),
      ),
    )
    process.stdout.write(`  Created trial subscriptions for ${usersNeedingSubscription.length} user(s)\n`)
  })
  process.stdout.write('\n')

  // Summary
  process.stdout.write('='.repeat(50) + '\n')
  process.stdout.write('Migration completed successfully!\n')
  process.stdout.write('='.repeat(50) + '\n')
  process.stdout.write(`  Users created/updated: ${createdUsers.length}\n`)
  process.stdout.write(`  Accounts migrated: ${accountMappings.length}\n`)
  process.stdout.write(`  Categories migrated: ${legacyCategories.length}\n`)
  process.stdout.write(`  Subscriptions created: ${migrationState.createdSubscriptionUserIds.length}\n`)
  process.stdout.write(`\nRollback state saved to: ${STATE_FILE}\n`)
  process.stdout.write('Run "npm run rollback:users" to revert if needed.\n')
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
