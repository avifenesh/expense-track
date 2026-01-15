import { prisma } from '@/lib/prisma'
import { Currency } from '@prisma/client'

// Fixed test user ID that matches the JWT tokens generated in tests
// Tests use generateAccessToken('avi', ...) which sets userId='avi'
export const TEST_USER_ID = 'avi'

// Cache test user for API tests
let testUser: Awaited<ReturnType<typeof prisma.user.upsert>> | null = null

/**
 * Get or create a test user for API tests
 * Uses a fixed ID ('avi') to match the JWT tokens generated in tests
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
      email: 'avi@example.com',
      displayName: 'API Test User',
      passwordHash: '$2b$10$placeholder', // Not used for auth
      preferredCurrency: Currency.USD,
    },
  })
  testUser = user
  return user
}

/**
 * Reset cached test user (call in cleanup)
 */
export function resetApiTestUser() {
  testUser = null
}
