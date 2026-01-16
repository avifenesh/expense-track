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

// Load .env file
config()

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg(new Pool({ connectionString: DATABASE_URL }))
const prisma = new PrismaClient({ adapter })

// Default account colors for seeded users
const ACCOUNT_COLORS = ['#0ea5e9', '#f472b6', '#10b981', '#f59e0b', '#8b5cf6']

interface SeedUser {
  email: string
  displayName: string
  passwordHash: string
  preferredCurrency: Currency
}

// Parse user data from environment variables
// User 1 is required, additional users are optional
function parseUserEnvVars(): SeedUser[] {
  const users: SeedUser[] = []

  // Parse user 1 (required)
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

  // Parse user 2 (optional)
  const user2Email = process.env.AUTH_USER2_EMAIL?.trim()
  const user2DisplayName = process.env.AUTH_USER2_DISPLAY_NAME?.trim()
  const user2PasswordHashRaw = process.env.AUTH_USER2_PASSWORD_HASH?.trim().replace(/^["']|["']$/g, '')
  const user2PasswordHash = user2PasswordHashRaw?.replace(/\\\$/g, '$')
  const user2PreferredCurrency = (process.env.AUTH_USER2_PREFERRED_CURRENCY as Currency) || Currency.USD

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

async function main() {
  const seedUsers = parseUserEnvVars()

  // Create users and their accounts
  const createdUsers = await Promise.all(
    seedUsers.map(async (userData, index) => {
      const user = await prisma.user.upsert({
        where: { email: userData.email },
        update: {
          displayName: userData.displayName,
          passwordHash: userData.passwordHash,
          preferredCurrency: userData.preferredCurrency,
        },
        create: {
          email: userData.email,
          displayName: userData.displayName,
          passwordHash: userData.passwordHash,
          preferredCurrency: userData.preferredCurrency,
        },
      })

      // Create a personal account using the user's display name
      await prisma.account.upsert({
        where: { userId_name: { userId: user.id, name: userData.displayName } },
        update: {
          type: AccountType.SELF,
          preferredCurrency: userData.preferredCurrency,
          color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
          icon: 'User',
        },
        create: {
          userId: user.id,
          name: userData.displayName,
          type: AccountType.SELF,
          preferredCurrency: userData.preferredCurrency,
          color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
          icon: 'User',
        },
      })

      return user
    }),
  )

  // Create default categories for the first user
  const primaryUser = createdUsers[0]

  // Expense categories
  const expenseCategories = DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
    name: cat.name,
    color: cat.color,
    type: TransactionType.EXPENSE,
    userId: primaryUser.id,
    isHolding: false,
  }))

  // Income categories
  const incomeCategories = DEFAULT_INCOME_CATEGORIES.map((cat) => ({
    name: cat.name,
    color: cat.color,
    type: TransactionType.INCOME,
    userId: primaryUser.id,
    isHolding: false,
  }))

  // Holding categories (used for investments/savings tracking)
  const holdingCategories = DEFAULT_HOLDING_CATEGORIES.map((cat) => ({
    name: cat.name,
    color: cat.color,
    type: TransactionType.EXPENSE,
    userId: primaryUser.id,
    isHolding: true,
  }))

  const allCategories = [...expenseCategories, ...incomeCategories, ...holdingCategories]

  await Promise.all(
    allCategories.map((category) =>
      prisma.category.upsert({
        where: {
          userId_name_type: {
            userId: category.userId,
            name: category.name,
            type: category.type,
          },
        },
        update: { color: category.color, isHolding: category.isHolding },
        create: category,
      }),
    ),
  )

  // Create trial subscriptions for all users
  const trialEndsAt = new Date()
  trialEndsAt.setDate(trialEndsAt.getDate() + TRIAL_DURATION_DAYS)

  await Promise.all(
    createdUsers.map((user) =>
      prisma.subscription.upsert({
        where: { userId: user.id },
        update: {},
        create: {
          userId: user.id,
          status: SubscriptionStatus.TRIALING,
          trialEndsAt,
        },
      }),
    ),
  )
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
