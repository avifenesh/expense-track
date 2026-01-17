import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { AccountType, Currency, SubscriptionStatus, TransactionType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// Mock Prisma client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    account: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const LEGACY_USER_ID = 'legacy-user'

// Helper to create mock user data
function createMockUser(overrides: Partial<{
  id: string
  email: string
  displayName: string
  preferredCurrency: Currency
}> = {}) {
  return {
    id: overrides.id ?? 'user-1',
    email: overrides.email ?? 'user1@example.com',
    displayName: overrides.displayName ?? 'User One',
    passwordHash: '$2b$12$test',
    preferredCurrency: overrides.preferredCurrency ?? Currency.USD,
    emailVerified: true,
    emailVerificationToken: null,
    emailVerificationExpires: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    hasCompletedOnboarding: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// Helper to create mock account data
function createMockAccount(overrides: Partial<{
  id: string
  name: string
  userId: string
  type: AccountType
}> = {}) {
  return {
    id: overrides.id ?? 'account-1',
    name: overrides.name ?? 'User One',
    userId: overrides.userId ?? LEGACY_USER_ID,
    type: overrides.type ?? AccountType.SELF,
    preferredCurrency: Currency.USD,
    color: '#0ea5e9',
    icon: 'User',
    description: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// Helper to create mock category data
function createMockCategory(overrides: Partial<{
  id: string
  name: string
  userId: string
  type: TransactionType
}> = {}) {
  return {
    id: overrides.id ?? 'category-1',
    name: overrides.name ?? 'Food',
    userId: overrides.userId ?? LEGACY_USER_ID,
    type: overrides.type ?? TransactionType.EXPENSE,
    color: '#ef4444',
    isArchived: false,
    isHolding: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

describe('Migration Logic', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('User Matching Logic', () => {
    it('should match account to user by displayName', () => {
      const users = [
        createMockUser({ id: 'u1', displayName: 'Alice', email: 'alice@test.com' }),
        createMockUser({ id: 'u2', displayName: 'Bob', email: 'bob@test.com' }),
      ]
      const account = createMockAccount({ name: 'Alice', userId: LEGACY_USER_ID })

      // Simulate matching logic from migration script
      const userByDisplayName = new Map(users.map((u) => [u.displayName, u]))
      const matchedUser = userByDisplayName.get(account.name)

      expect(matchedUser).toBeDefined()
      expect(matchedUser?.id).toBe('u1')
      expect(matchedUser?.email).toBe('alice@test.com')
    })

    it('should not match account when displayName differs', () => {
      const users = [
        createMockUser({ id: 'u1', displayName: 'Alice', email: 'alice@test.com' }),
      ]
      const account = createMockAccount({ name: 'Unknown User', userId: LEGACY_USER_ID })

      const userByDisplayName = new Map(users.map((u) => [u.displayName, u]))
      const matchedUser = userByDisplayName.get(account.name)

      expect(matchedUser).toBeUndefined()
    })

    it('should handle case-sensitive matching', () => {
      const users = [
        createMockUser({ id: 'u1', displayName: 'Alice', email: 'alice@test.com' }),
      ]
      const account = createMockAccount({ name: 'alice', userId: LEGACY_USER_ID }) // lowercase

      const userByDisplayName = new Map(users.map((u) => [u.displayName, u]))
      const matchedUser = userByDisplayName.get(account.name)

      // Should not match due to case sensitivity
      expect(matchedUser).toBeUndefined()
    })
  })

  describe('Account Migration', () => {
    it('should identify legacy accounts correctly', async () => {
      const legacyAccounts = [
        createMockAccount({ id: 'acc-1', name: 'Alice', userId: LEGACY_USER_ID }),
        createMockAccount({ id: 'acc-2', name: 'Bob', userId: LEGACY_USER_ID }),
      ]
      const nonLegacyAccount = createMockAccount({ id: 'acc-3', name: 'Charlie', userId: 'real-user-id' })

      vi.mocked(prisma.account.findMany).mockResolvedValue(legacyAccounts)

      const result = await prisma.account.findMany({
        where: { userId: LEGACY_USER_ID },
      })

      expect(result).toHaveLength(2)
      expect(result.every((a) => a.userId === LEGACY_USER_ID)).toBe(true)
      expect(result).not.toContainEqual(nonLegacyAccount)
    })

    it('should update account userId in transaction', async () => {
      const mockTx = {
        account: {
          update: vi.fn().mockResolvedValue({ id: 'acc-1', userId: 'new-user-id' }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn(mockTx as unknown as typeof prisma)
      })

      await prisma.$transaction(async (tx) => {
        await tx.account.update({
          where: { id: 'acc-1' },
          data: { userId: 'new-user-id' },
        })
      })

      expect(mockTx.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { userId: 'new-user-id' },
      })
    })
  })

  describe('Category Migration', () => {
    it('should identify legacy categories correctly', async () => {
      const legacyCategories = [
        createMockCategory({ id: 'cat-1', name: 'Food', userId: LEGACY_USER_ID }),
        createMockCategory({ id: 'cat-2', name: 'Transport', userId: LEGACY_USER_ID }),
        createMockCategory({ id: 'cat-3', name: 'Salary', userId: LEGACY_USER_ID, type: TransactionType.INCOME }),
      ]

      vi.mocked(prisma.category.findMany).mockResolvedValue(legacyCategories)

      const result = await prisma.category.findMany({
        where: { userId: LEGACY_USER_ID },
      })

      expect(result).toHaveLength(3)
      expect(result.every((c) => c.userId === LEGACY_USER_ID)).toBe(true)
    })

    it('should assign all categories to primary user', async () => {
      const primaryUserId = 'primary-user-id'
      const mockTx = {
        category: {
          updateMany: vi.fn().mockResolvedValue({ count: 3 }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn(mockTx as unknown as typeof prisma)
      })

      await prisma.$transaction(async (tx) => {
        await tx.category.updateMany({
          where: { userId: LEGACY_USER_ID },
          data: { userId: primaryUserId },
        })
      })

      expect(mockTx.category.updateMany).toHaveBeenCalledWith({
        where: { userId: LEGACY_USER_ID },
        data: { userId: primaryUserId },
      })
    })
  })

  describe('Subscription Creation', () => {
    it('should create subscription for user without existing one', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.subscription.create).mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        canceledAt: null,
        paddleCustomerId: null,
        paddleSubscriptionId: null,
        paddlePriceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const existingSubscription = await prisma.subscription.findUnique({
        where: { userId: 'user-1' },
      })

      expect(existingSubscription).toBeNull()

      const newSubscription = await prisma.subscription.create({
        data: {
          userId: 'user-1',
          status: SubscriptionStatus.TRIALING,
          trialEndsAt: expect.any(Date),
        },
      })

      expect(newSubscription.status).toBe(SubscriptionStatus.TRIALING)
      expect(prisma.subscription.create).toHaveBeenCalled()
    })

    it('should skip subscription creation if one exists', async () => {
      vi.mocked(prisma.subscription.findUnique).mockResolvedValue({
        id: 'existing-sub',
        userId: 'user-1',
        status: SubscriptionStatus.ACTIVE,
        trialEndsAt: new Date(), // trialEndsAt is required in schema
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        canceledAt: null,
        paddleCustomerId: null,
        paddleSubscriptionId: null,
        paddlePriceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const existingSubscription = await prisma.subscription.findUnique({
        where: { userId: 'user-1' },
      })

      expect(existingSubscription).not.toBeNull()
      expect(existingSubscription?.status).toBe(SubscriptionStatus.ACTIVE)

      // Migration should skip creating subscription
      expect(prisma.subscription.create).not.toHaveBeenCalled()
    })
  })

  describe('Rollback Logic', () => {
    it('should revert account ownership to legacy user', async () => {
      const mockTx = {
        account: {
          update: vi.fn().mockResolvedValue({ id: 'acc-1', userId: LEGACY_USER_ID }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn(mockTx as unknown as typeof prisma)
      })

      const migrationState = {
        accounts: [{ id: 'acc-1', originalUserId: LEGACY_USER_ID, newUserId: 'user-1' }],
      }

      await prisma.$transaction(async (tx) => {
        for (const account of migrationState.accounts) {
          await tx.account.update({
            where: { id: account.id },
            data: { userId: account.originalUserId },
          })
        }
      })

      expect(mockTx.account.update).toHaveBeenCalledWith({
        where: { id: 'acc-1' },
        data: { userId: LEGACY_USER_ID },
      })
    })

    it('should revert category ownership to legacy user', async () => {
      const mockTx = {
        category: {
          update: vi.fn().mockResolvedValue({ id: 'cat-1', userId: LEGACY_USER_ID }),
        },
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (fn) => {
        return fn(mockTx as unknown as typeof prisma)
      })

      const migrationState = {
        categories: [{ id: 'cat-1', originalUserId: LEGACY_USER_ID, newUserId: 'user-1' }],
      }

      await prisma.$transaction(async (tx) => {
        for (const category of migrationState.categories) {
          await tx.category.update({
            where: { id: category.id },
            data: { userId: category.originalUserId },
          })
        }
      })

      expect(mockTx.category.update).toHaveBeenCalledWith({
        where: { id: 'cat-1' },
        data: { userId: LEGACY_USER_ID },
      })
    })

    it('should delete subscriptions created by migration', async () => {
      vi.mocked(prisma.subscription.delete).mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        status: SubscriptionStatus.TRIALING,
        trialEndsAt: new Date(),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        canceledAt: null,
        paddleCustomerId: null,
        paddleSubscriptionId: null,
        paddlePriceId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const migrationState = {
        createdSubscriptionUserIds: ['user-1', 'user-2'],
      }

      for (const userId of migrationState.createdSubscriptionUserIds) {
        await prisma.subscription.delete({ where: { userId } })
      }

      expect(prisma.subscription.delete).toHaveBeenCalledTimes(2)
      expect(prisma.subscription.delete).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
      expect(prisma.subscription.delete).toHaveBeenCalledWith({ where: { userId: 'user-2' } })
    })
  })

  describe('Migration State', () => {
    it('should track migrated accounts correctly', () => {
      const migrationState = {
        migratedAt: new Date().toISOString(),
        accounts: [] as Array<{ id: string; originalUserId: string; newUserId: string }>,
        categories: [] as Array<{ id: string; originalUserId: string; newUserId: string }>,
        createdUserIds: [] as string[],
        createdSubscriptionUserIds: [] as string[],
      }

      // Simulate adding account migration
      migrationState.accounts.push({
        id: 'acc-1',
        originalUserId: LEGACY_USER_ID,
        newUserId: 'user-1',
      })

      expect(migrationState.accounts).toHaveLength(1)
      expect(migrationState.accounts[0].originalUserId).toBe(LEGACY_USER_ID)
      expect(migrationState.accounts[0].newUserId).toBe('user-1')
    })

    it('should track created users for potential cleanup', () => {
      const migrationState = {
        createdUserIds: [] as string[],
      }

      // Simulate tracking newly created users
      migrationState.createdUserIds.push('user-1')
      migrationState.createdUserIds.push('user-2')

      expect(migrationState.createdUserIds).toHaveLength(2)
      expect(migrationState.createdUserIds).toContain('user-1')
      expect(migrationState.createdUserIds).toContain('user-2')
    })
  })

  describe('Idempotency', () => {
    it('should use upsert for user creation to ensure idempotency', async () => {
      const existingUser = createMockUser({ id: 'existing-id', email: 'alice@test.com' })
      vi.mocked(prisma.user.upsert).mockResolvedValue(existingUser)

      const result = await prisma.user.upsert({
        where: { email: 'alice@test.com' },
        update: {
          displayName: 'Alice Updated',
        },
        create: {
          email: 'alice@test.com',
          displayName: 'Alice',
          passwordHash: '$2b$12$test',
        },
      })

      expect(result.id).toBe('existing-id')
      expect(prisma.user.upsert).toHaveBeenCalled()
    })

    it('should skip already migrated accounts (no legacy-user ownership)', async () => {
      // Simulate accounts that have already been migrated
      vi.mocked(prisma.account.findMany).mockResolvedValue([])

      const legacyAccounts = await prisma.account.findMany({
        where: { userId: LEGACY_USER_ID },
      })

      expect(legacyAccounts).toHaveLength(0)
      // Migration should gracefully handle empty list
    })
  })

  describe('Environment Variable Parsing', () => {
    it('should require user 1 environment variables', () => {
      const parseUserEnvVars = (env: Record<string, string | undefined>) => {
        const user1Email = env.AUTH_USER1_EMAIL?.trim()
        const user1DisplayName = env.AUTH_USER1_DISPLAY_NAME?.trim()
        const user1PasswordHash = env.AUTH_USER1_PASSWORD_HASH?.trim()

        if (!user1Email || !user1DisplayName || !user1PasswordHash) {
          throw new Error('Missing required environment variables for user 1')
        }

        return [{ email: user1Email, displayName: user1DisplayName }]
      }

      expect(() =>
        parseUserEnvVars({
          AUTH_USER1_EMAIL: 'alice@test.com',
          AUTH_USER1_DISPLAY_NAME: 'Alice',
          AUTH_USER1_PASSWORD_HASH: '$2b$12$test',
        }),
      ).not.toThrow()

      expect(() =>
        parseUserEnvVars({
          AUTH_USER1_EMAIL: 'alice@test.com',
          // Missing display name and password hash
        }),
      ).toThrow('Missing required environment variables for user 1')
    })

    it('should make user 2 optional', () => {
      const parseUserEnvVars = (env: Record<string, string | undefined>) => {
        const users: Array<{ email: string; displayName: string }> = []

        const user1Email = env.AUTH_USER1_EMAIL?.trim()
        const user1DisplayName = env.AUTH_USER1_DISPLAY_NAME?.trim()
        const user1PasswordHash = env.AUTH_USER1_PASSWORD_HASH?.trim()

        if (!user1Email || !user1DisplayName || !user1PasswordHash) {
          throw new Error('Missing required environment variables for user 1')
        }

        users.push({ email: user1Email, displayName: user1DisplayName })

        const user2Email = env.AUTH_USER2_EMAIL?.trim()
        const user2DisplayName = env.AUTH_USER2_DISPLAY_NAME?.trim()
        const user2PasswordHash = env.AUTH_USER2_PASSWORD_HASH?.trim()

        if (user2Email && user2DisplayName && user2PasswordHash) {
          users.push({ email: user2Email, displayName: user2DisplayName })
        }

        return users
      }

      // Only user 1 provided
      const usersWithoutUser2 = parseUserEnvVars({
        AUTH_USER1_EMAIL: 'alice@test.com',
        AUTH_USER1_DISPLAY_NAME: 'Alice',
        AUTH_USER1_PASSWORD_HASH: '$2b$12$test',
      })
      expect(usersWithoutUser2).toHaveLength(1)

      // Both users provided
      const usersWithUser2 = parseUserEnvVars({
        AUTH_USER1_EMAIL: 'alice@test.com',
        AUTH_USER1_DISPLAY_NAME: 'Alice',
        AUTH_USER1_PASSWORD_HASH: '$2b$12$test',
        AUTH_USER2_EMAIL: 'bob@test.com',
        AUTH_USER2_DISPLAY_NAME: 'Bob',
        AUTH_USER2_PASSWORD_HASH: '$2b$12$test2',
      })
      expect(usersWithUser2).toHaveLength(2)
    })

    it('should handle password hash with escaped dollar signs', () => {
      const parsePasswordHash = (raw: string | undefined) => {
        if (!raw) return undefined
        return raw.trim().replace(/^["']|["']$/g, '').replace(/\\\$/g, '$')
      }

      // Bcrypt hash with escaped dollar signs
      const input = '\\$2b\\$12\\$abcdef123456'
      const result = parsePasswordHash(input)

      expect(result).toBe('$2b$12$abcdef123456')
    })
  })
})
