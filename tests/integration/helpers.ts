import { prisma } from '@/lib/prisma'
import { TransactionType, Currency, AccountType } from '@prisma/client'

// Cache test user ID for integration tests
let testUserId: string | null = null

/**
 * Get or create a test user for integration tests
 */
export async function getTestUser() {
  if (testUserId) {
    const existing = await prisma.user.findUnique({ where: { id: testUserId } })
    if (existing) return existing
  }

  const user = await prisma.user.upsert({
    where: { email: 'test-integration@example.com' },
    update: {},
    create: {
      email: 'test-integration@example.com',
      displayName: 'Integration Test User',
      passwordHash: '$2b$10$placeholder', // Not used for auth
      preferredCurrency: Currency.USD,
    },
  })
  testUserId = user.id
  return user
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
  await prisma.transaction.deleteMany({
    where: { description: { contains: 'TEST_' } },
  })
  await prisma.transactionRequest.deleteMany({
    where: { description: { contains: 'TEST_' } },
  })
  await prisma.budget.deleteMany({
    where: { notes: { contains: 'TEST_' } },
  })
  await prisma.recurringTemplate.deleteMany({
    where: { description: { contains: 'TEST_' } },
  })
  await prisma.holding.deleteMany({
    where: { notes: { contains: 'TEST_' } },
  })
  // Clean up categories and accounts created by integration tests
  await prisma.category.deleteMany({
    where: { name: { contains: 'TEST_' } },
  })
  await prisma.account.deleteMany({
    where: { name: { contains: 'TEST_' } },
  })
  // Clean up test users (integration test user)
  await prisma.user.deleteMany({
    where: { email: { contains: 'test-integration' } },
  })
  // Reset cached test user ID
  testUserId = null
}

/**
 * Mock CSRF token for integration tests
 */
export const MOCK_CSRF_TOKEN = 'test-csrf-token-integration'
