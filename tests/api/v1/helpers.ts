import { prisma } from '@/lib/prisma'
import { Currency } from '@prisma/client'

// Fixed test user ID that matches the JWT tokens generated in tests
export const TEST_USER_ID = 'api-test-user'

// Second user ID for testing unauthorized access scenarios
export const OTHER_USER_ID = 'api-other-user'

// Cache test users for API tests
let testUser: Awaited<ReturnType<typeof prisma.user.upsert>> | null = null
let otherUser: Awaited<ReturnType<typeof prisma.user.upsert>> | null = null

/**
 * Get or create a test user for API tests
 */
export async function getApiTestUser() {
  if (testUser) {
    const existing = await prisma.user.findUnique({ where: { id: testUser.id } })
    if (existing) return existing
  }

  const user = await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      email: 'api-test@example.com',
      displayName: 'API Test User',
      passwordHash: '$2b$10$placeholder', // Not used for auth
      preferredCurrency: Currency.USD,
    },
  })
  testUser = user
  return user
}

/**
 * Get or create a secondary test user for unauthorized access testing
 * This user owns accounts that the primary test user should NOT have access to
 */
export async function getOtherTestUser() {
  if (otherUser) {
    const existing = await prisma.user.findUnique({ where: { id: otherUser.id } })
    if (existing) return existing
  }

  const user = await prisma.user.upsert({
    where: { id: OTHER_USER_ID },
    update: {},
    create: {
      id: OTHER_USER_ID,
      email: 'api-other@example.com',
      displayName: 'API Other User',
      passwordHash: '$2b$10$placeholder', // Not used for auth
      preferredCurrency: Currency.USD,
    },
  })
  otherUser = user
  return user
}

/**
 * Reset cached test user (call in cleanup)
 */
export function resetApiTestUser() {
  testUser = null
  otherUser = null
}
