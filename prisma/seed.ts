import { config } from 'dotenv'
import { PrismaPg } from '@prisma/adapter-pg'
import { AccountType, Currency, PrismaClient, TransactionType } from '@prisma/client'
import { Pool } from 'pg'

// Load .env file
config()

const DATABASE_URL = process.env.DATABASE_URL

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL is not set')
}

const adapter = new PrismaPg(new Pool({ connectionString: DATABASE_URL }))
const prisma = new PrismaClient({ adapter })

// Parse user data from environment variables (same pattern as src/lib/auth.ts)
function parseUserEnvVars() {
  const user1Email = process.env.AUTH_USER1_EMAIL?.trim()
  const user1DisplayName = process.env.AUTH_USER1_DISPLAY_NAME?.trim()
  const user1PasswordHashRaw = process.env.AUTH_USER1_PASSWORD_HASH?.trim().replace(/^["']|["']$/g, '')
  const user1PasswordHash = user1PasswordHashRaw?.replace(/\\\$/g, '$')
  const user1PreferredCurrency = (process.env.AUTH_USER1_PREFERRED_CURRENCY as Currency) || Currency.USD

  const user2Email = process.env.AUTH_USER2_EMAIL?.trim()
  const user2DisplayName = process.env.AUTH_USER2_DISPLAY_NAME?.trim()
  const user2PasswordHashRaw = process.env.AUTH_USER2_PASSWORD_HASH?.trim().replace(/^["']|["']$/g, '')
  const user2PasswordHash = user2PasswordHashRaw?.replace(/\\\$/g, '$')
  const user2PreferredCurrency = (process.env.AUTH_USER2_PREFERRED_CURRENCY as Currency) || Currency.USD

  if (!user1Email || !user1DisplayName || !user1PasswordHash) {
    throw new Error('Missing required environment variables for user 1 (AUTH_USER1_*)')
  }

  if (!user2Email || !user2DisplayName || !user2PasswordHash) {
    throw new Error('Missing required environment variables for user 2 (AUTH_USER2_*)')
  }

  return {
    user1: {
      email: user1Email,
      displayName: user1DisplayName,
      passwordHash: user1PasswordHash,
      preferredCurrency: user1PreferredCurrency,
    },
    user2: {
      email: user2Email,
      displayName: user2DisplayName,
      passwordHash: user2PasswordHash,
      preferredCurrency: user2PreferredCurrency,
    },
  }
}

async function main() {
  const { user1, user2 } = parseUserEnvVars()

  // Create users
  const createdUser1 = await prisma.user.upsert({
    where: { email: user1.email },
    update: {
      displayName: user1.displayName,
      passwordHash: user1.passwordHash,
      preferredCurrency: user1.preferredCurrency,
    },
    create: {
      email: user1.email,
      displayName: user1.displayName,
      passwordHash: user1.passwordHash,
      preferredCurrency: user1.preferredCurrency,
    },
  })

  const createdUser2 = await prisma.user.upsert({
    where: { email: user2.email },
    update: {
      displayName: user2.displayName,
      passwordHash: user2.passwordHash,
      preferredCurrency: user2.preferredCurrency,
    },
    create: {
      email: user2.email,
      displayName: user2.displayName,
      passwordHash: user2.passwordHash,
      preferredCurrency: user2.preferredCurrency,
    },
  })

  // Create accounts linked to users
  const accounts = [
    {
      userId: createdUser1.id,
      name: 'Avi',
      type: AccountType.SELF,
      preferredCurrency: Currency.ILS,
      color: '#0ea5e9',
      icon: 'User',
    },
    {
      userId: createdUser2.id,
      name: 'Serena',
      type: AccountType.PARTNER,
      preferredCurrency: Currency.EUR,
      color: '#f472b6',
      icon: 'Heart',
    },
  ]

  await Promise.all(
    accounts.map((account) =>
      prisma.account.upsert({
        where: { userId_name: { userId: account.userId, name: account.name } },
        update: {
          type: account.type,
          preferredCurrency: account.preferredCurrency,
          color: account.color,
          icon: account.icon,
        },
        create: account,
      }),
    ),
  )

  // Categories are linked to user1 (Avi) as the default owner
  // In a multi-tenant SaaS, each user would have their own categories
  const categoryData = [
    { name: 'Pegasus (Dog)', type: TransactionType.EXPENSE, color: '#fb7185' },
    { name: 'House - New Furnitures', type: TransactionType.EXPENSE, color: '#c084fc' },
    { name: 'Rent', type: TransactionType.EXPENSE, color: '#ef4444' },
    { name: 'Electricity', type: TransactionType.EXPENSE, color: '#fde047' },
    { name: 'Gas', type: TransactionType.EXPENSE, color: '#fbbf24' },
    { name: 'Water', type: TransactionType.EXPENSE, color: '#38bdf8' },
    { name: 'Arnona taxes', type: TransactionType.EXPENSE, color: '#94a3b8' },
    { name: 'Groceries', type: TransactionType.EXPENSE, color: '#84cc16' },
    { name: 'Travels', type: TransactionType.EXPENSE, color: '#6366f1' },
    { name: 'Eat outside', type: TransactionType.EXPENSE, color: '#f97316' },
    { name: 'Weddings', type: TransactionType.EXPENSE, color: '#f9a8d4' },
    { name: 'Accommodations', type: TransactionType.EXPENSE, color: '#f59e0b' },
    { name: 'Therapy', type: TransactionType.EXPENSE, color: '#a78bfa' },
    { name: 'Couple Therapy', type: TransactionType.EXPENSE, color: '#f472b6' },
    { name: 'Going out', type: TransactionType.EXPENSE, color: '#22d3ee' },
    { name: 'Vacations', type: TransactionType.EXPENSE, color: '#10b981' },
    { name: 'Computing', type: TransactionType.EXPENSE, color: '#60a5fa' },
    { name: 'Other taxes', type: TransactionType.EXPENSE, color: '#facc15' },
    { name: 'Others', type: TransactionType.EXPENSE, color: '#e5e7eb' },
    { name: 'Nails', type: TransactionType.EXPENSE, color: '#f472b6' },
    { name: 'Shopping', type: TransactionType.EXPENSE, color: '#d946ef' },
    { name: 'Army bonus', type: TransactionType.INCOME, color: '#14b8a6' },
    { name: 'Army returns', type: TransactionType.INCOME, color: '#0ea5e9' },
    { name: 'Salary', type: TransactionType.INCOME, color: '#1d4ed8' },
    { name: 'Secondary salary', type: TransactionType.INCOME, color: '#7c3aed' },
    { name: 'Savings', type: TransactionType.EXPENSE, color: '#16a34a', isHolding: true },
    { name: 'Stocks', type: TransactionType.EXPENSE, color: '#0f172a', isHolding: true },
    { name: 'ETF', type: TransactionType.EXPENSE, color: '#0ea5e9', isHolding: true },
  ]

  // Create categories for user1 (shared categories assigned to primary user)
  const categories = categoryData.map((cat) => ({ ...cat, userId: createdUser1.id }))

  await Promise.all(
    categories.map((category) =>
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
