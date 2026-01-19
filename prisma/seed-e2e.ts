import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { AccountType, Currency, PrismaClient, SubscriptionStatus, TransactionType } from '@prisma/client'
import { Pool } from 'pg'
import { TRIAL_DURATION_DAYS } from '../src/lib/subscription-constants'
import {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_HOLDING_CATEGORIES,
} from '../src/lib/default-categories'

// Load .env.e2e file
config({ path: '.env.e2e' })

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env.e2e')
}

const adapter = new PrismaPg(new Pool({ connectionString: DATABASE_URL }))
const prisma = new PrismaClient({ adapter })

const ACCOUNT_COLORS = ['#0ea5e9', '#f472b6', '#10b981', '#f59e0b', '#8b5cf6']

interface SeedUser {
  email: string
  displayName: string
  passwordHash: string
  preferredCurrency: Currency
}

function parseUserEnvVars(): SeedUser[] {
  const users: SeedUser[] = []

  // Parse user 1 (required for E2E tests)
  const user1Email = process.env.AUTH_USER1_EMAIL?.trim()
  const user1DisplayName = process.env.AUTH_USER1_DISPLAY_NAME?.trim()
  const user1PasswordHashRaw = process.env.AUTH_USER1_PASSWORD_HASH?.trim().replace(/^["']|["']$/g, '')
  const user1PasswordHash = user1PasswordHashRaw?.replace(/\\\$/g, '$')
  const user1PreferredCurrency = (process.env.AUTH_USER1_PREFERRED_CURRENCY as Currency) || Currency.USD

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

  // Parse user 2 (required for E2E tests)
  const user2Email = process.env.AUTH_USER2_EMAIL?.trim()
  const user2DisplayName = process.env.AUTH_USER2_DISPLAY_NAME?.trim()
  const user2PasswordHashRaw = process.env.AUTH_USER2_PASSWORD_HASH?.trim().replace(/^["']|["']$/g, '')
  const user2PasswordHash = user2PasswordHashRaw?.replace(/\\\$/g, '$')
  const user2PreferredCurrency = (process.env.AUTH_USER2_PREFERRED_CURRENCY as Currency) || Currency.USD

  if (!user2Email || !user2DisplayName || !user2PasswordHash) {
    throw new Error(
      'Missing required environment variables for user 2 (AUTH_USER2_EMAIL, AUTH_USER2_DISPLAY_NAME, AUTH_USER2_PASSWORD_HASH)',
    )
  }

  users.push({
    email: user2Email,
    displayName: user2DisplayName,
    passwordHash: user2PasswordHash,
    preferredCurrency: user2PreferredCurrency,
  })

  return users
}

async function main() {
  console.log('Starting E2E database seed...')

  const seedUsers = parseUserEnvVars()

  // Create users and their accounts
  const createdUsers = await Promise.all(
    seedUsers.map(async (userData, index) => {
      console.log(`Creating user: ${userData.email}`)

      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {
          displayName: userData.displayName,
          passwordHash: userData.passwordHash,
          preferredCurrency: userData.preferredCurrency,
          isEmailVerified: true,
          hasCompletedOnboarding: true,
        },
        create: {
          email: userData.email,
          displayName: userData.displayName,
          passwordHash: userData.passwordHash,
          preferredCurrency: userData.preferredCurrency,
          isEmailVerified: true,
          hasCompletedOnboarding: true,
        },
      })

      // Create subscription record
      const trialEndsAt = new Date()
      trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS)

      await prisma.subscription.upsert({
        where: { userId: user.id },
        update: {
          status: SubscriptionStatus.TRIAL,
          trialEndsAt,
        },
        create: {
          userId: user.id,
          status: SubscriptionStatus.TRIAL,
          trialEndsAt,
        },
      })

      // Create personal account
      const personalAccount = await prisma.account.upsert({
        where: {
          userId_name: {
            userId: user.id,
            name: userData.displayName,
          },
        },
        update: {},
        create: {
          userId: user.id,
          name: userData.displayName,
          type: AccountType.PERSONAL,
          color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
        },
      })

      // Set active account
      await prisma.user.update({
        where: { id: user.id },
        data: { activeAccountId: personalAccount.id },
      })

      // Create default categories for each user
      const categoryData = [
        ...DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
          userId: user.id,
          name: cat.name,
          type: TransactionType.EXPENSE,
          icon: cat.icon,
          isArchived: false,
        })),
        ...DEFAULT_INCOME_CATEGORIES.map((cat) => ({
          userId: user.id,
          name: cat.name,
          type: TransactionType.INCOME,
          icon: cat.icon,
          isArchived: false,
        })),
        ...DEFAULT_HOLDING_CATEGORIES.map((cat) => ({
          userId: user.id,
          name: cat.name,
          type: TransactionType.HOLDING,
          icon: cat.icon,
          isArchived: false,
        })),
      ]

      for (const category of categoryData) {
        await prisma.category.upsert({
          where: {
            userId_name_type: {
              userId: user.id,
              name: category.name,
              type: category.type,
            },
          },
          update: {},
          create: category,
        })
      }

      console.log(`Created user ${userData.email} with personal account ${userData.displayName}`)

      return { user, personalAccount }
    }),
  )

  // Create joint account shared between users
  if (createdUsers.length >= 2) {
    console.log('Creating joint account...')

    const jointAccount = await prisma.account.upsert({
      where: {
        userId_name: {
          userId: createdUsers[0].user.id,
          name: 'Joint',
        },
      },
      update: {},
      create: {
        userId: createdUsers[0].user.id,
        name: 'Joint',
        type: AccountType.JOINT,
        color: '#10b981',
      },
    })

    // Add sharing relationships for all users
    for (const { user } of createdUsers) {
      await prisma.accountShare.upsert({
        where: {
          accountId_userId: {
            accountId: jointAccount.id,
            userId: user.id,
          },
        },
        update: {},
        create: {
          accountId: jointAccount.id,
          userId: user.id,
        },
      })
    }

    console.log('Created joint account shared by all test users')
  }

  console.log('E2E database seed complete!')
}

main()
  .catch((error) => {
    console.error('Error seeding database:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
