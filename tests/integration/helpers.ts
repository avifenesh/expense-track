import { prisma } from '@/lib/prisma'
import { TransactionType, Currency, AccountType } from '@prisma/client'

/**
 * Fixed test user ID for integration tests.
 * Used by both database setup and auth mocks to ensure consistent access checks.
 */
export const TEST_USER_ID = 'test-user-id'
export const TEST_USER_EMAIL = 'test@example.com'

/**
 * Get or create a test user for integration tests with a fixed ID.
 */
export async function getTestUser() {
  const existing = await prisma.user.findUnique({ where: { id: TEST_USER_ID } })
  if (existing) return existing

  return prisma.user.create({
    data: {
      id: TEST_USER_ID,
      email: TEST_USER_EMAIL,
      displayName: 'Test User',
      passwordHash: '$2b$10$placeholder', // Not used for auth
      preferredCurrency: Currency.USD,
    },
  })
}

/**
 * Create a test account (upsert to avoid duplicates)
 */
export async function createTestAccount(name: string, type: AccountType = 'SELF') {
  const user = await getTestUser()
  return prisma.account.upsert({
    where: { userId_name: { userId: user.id, name } },
    update: {},
    create: { userId: user.id, name, type, preferredCurrency: Currency.USD },
  })
}

/**
 * Create a test category (upsert to avoid duplicates)
 */
export async function createTestCategory(name: string, type: TransactionType) {
  const user = await getTestUser()
  return prisma.category.upsert({
    where: { userId_name_type: { userId: user.id, name, type } },
    update: {},
    create: { userId: user.id, name, type },
  })
}

/**
 * Cleanup all test data (called in afterEach)
 */
export async function cleanupTestData() {
  // Delete in order to respect foreign key constraints
  // Delete transactions by description OR by test category/account reference
  await prisma.transaction.deleteMany({
    where: {
      OR: [
        { description: { contains: 'TEST_' } },
        { category: { name: { contains: 'TEST_' } } },
        { account: { name: { contains: 'TEST_' } } },
      ],
    },
  })
  await prisma.transactionRequest.deleteMany({
    where: {
      OR: [
        { description: { contains: 'TEST_' } },
        { category: { name: { contains: 'TEST_' } } },
        { from: { name: { contains: 'TEST_' } } },
        { to: { name: { contains: 'TEST_' } } },
      ],
    },
  })
  // Delete budgets by notes OR by test category/account reference
  await prisma.budget.deleteMany({
    where: {
      OR: [
        { notes: { contains: 'TEST_' } },
        { category: { name: { contains: 'TEST_' } } },
        { account: { name: { contains: 'TEST_' } } },
      ],
    },
  })
  // Delete recurring templates by description OR by test category/account reference
  await prisma.recurringTemplate.deleteMany({
    where: {
      OR: [
        { description: { contains: 'TEST_' } },
        { category: { name: { contains: 'TEST_' } } },
        { account: { name: { contains: 'TEST_' } } },
      ],
    },
  })
  // Delete holdings by notes OR by test category/account reference
  // This ensures we catch any holdings referencing test data even if notes don't match
  await prisma.holding.deleteMany({
    where: {
      OR: [
        { notes: { contains: 'TEST_' } },
        { category: { name: { contains: 'TEST_' } } },
        { account: { name: { contains: 'TEST_' } } },
      ],
    },
  })
  // Clean up categories and accounts created by integration tests
  await prisma.category.deleteMany({
    where: { name: { contains: 'TEST_' } },
  })
  await prisma.account.deleteMany({
    where: { name: { contains: 'TEST_' } },
  })
  // Clean up test user (fixed ID)
  await prisma.user.deleteMany({
    where: { id: TEST_USER_ID },
  })
}

/**
 * Mock CSRF token for integration tests
 */
export const MOCK_CSRF_TOKEN = 'test-csrf-token-integration'
