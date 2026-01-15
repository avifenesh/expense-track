import { prisma } from '@/lib/prisma'
import { TransactionType, Currency, AccountType } from '@prisma/client'

/**
 * Create a test account (upsert to avoid duplicates)
 */
export async function createTestAccount(name: string, type: AccountType = 'SELF') {
  return prisma.account.upsert({
    where: { name },
    update: {},
    create: { name, type, preferredCurrency: Currency.USD },
  })
}

/**
 * Create a test category (upsert to avoid duplicates)
 */
export async function createTestCategory(name: string, type: TransactionType) {
  return prisma.category.upsert({
    where: { name_type: { name, type } },
    update: {},
    create: { name, type },
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
}

/**
 * Mock CSRF token for integration tests
 */
export const MOCK_CSRF_TOKEN = 'test-csrf-token-integration'
