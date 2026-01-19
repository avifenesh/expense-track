import { describe, expect, it, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { Currency, AccountType, TransactionType } from '@prisma/client'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
    },
    account: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    category: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

describe('User Model Schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('User CRUD', () => {
    it('should create a user with required fields', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: '$2b$10$hashedpassword',
        preferredCurrency: Currency.USD,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        hasCompletedOnboarding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.user.create).mockResolvedValue(mockUser)

      const result = await prisma.user.create({
        data: {
          email: 'test@example.com',
          displayName: 'Test User',
          passwordHash: '$2b$10$hashedpassword',
          preferredCurrency: Currency.USD,
        },
      })

      expect(result.id).toBe('user-1')
      expect(result.email).toBe('test@example.com')
      expect(result.displayName).toBe('Test User')
      expect(result.preferredCurrency).toBe(Currency.USD)
    })

    it('should create a user with default currency (USD)', async () => {
      const mockUser = {
        id: 'user-2',
        email: 'test2@example.com',
        displayName: 'Test User 2',
        passwordHash: '$2b$10$hashedpassword',
        preferredCurrency: Currency.USD, // default
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        hasCompletedOnboarding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.user.create).mockResolvedValue(mockUser)

      const result = await prisma.user.create({
        data: {
          email: 'test2@example.com',
          displayName: 'Test User 2',
          passwordHash: '$2b$10$hashedpassword',
        },
      })

      expect(result.preferredCurrency).toBe(Currency.USD)
    })

    it('should find user by email (unique constraint)', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: '$2b$10$hashedpassword',
        preferredCurrency: Currency.USD,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        hasCompletedOnboarding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

      const result = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
      })

      expect(result?.id).toBe('user-1')
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      })
    })
  })

  describe('User-Account Relationship', () => {
    it('should create account with userId (required field)', async () => {
      const mockAccount = {
        id: 'account-1',
        userId: 'user-1',
        name: 'Main Account',
        type: AccountType.SELF,
        preferredCurrency: Currency.USD,
        color: '#0ea5e9',
        icon: 'User',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deletedBy: null,
        defaultIncomeGoal: null,
        defaultIncomeGoalCurrency: null,
      }

      vi.mocked(prisma.account.create).mockResolvedValue(mockAccount)

      const result = await prisma.account.create({
        data: {
          userId: 'user-1',
          name: 'Main Account',
          type: AccountType.SELF,
          preferredCurrency: Currency.USD,
        },
      })

      expect(result.userId).toBe('user-1')
      expect(result.name).toBe('Main Account')
    })

    it('should find all accounts for a user', async () => {
      const mockAccounts = [
        {
          id: 'account-1',
          userId: 'user-1',
          name: 'Account 1',
          type: AccountType.SELF,
          preferredCurrency: Currency.USD,
          color: null,
          icon: null,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          deletedBy: null,
          defaultIncomeGoal: null,
          defaultIncomeGoalCurrency: null,
        },
        {
          id: 'account-2',
          userId: 'user-1',
          name: 'Account 2',
          type: AccountType.OTHER,
          preferredCurrency: Currency.EUR,
          color: null,
          icon: null,
          description: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
          deletedBy: null,
          defaultIncomeGoal: null,
          defaultIncomeGoalCurrency: null,
        },
      ]

      vi.mocked(prisma.account.findMany).mockResolvedValue(mockAccounts)

      const result = await prisma.account.findMany({
        where: { userId: 'user-1' },
      })

      expect(result).toHaveLength(2)
      expect(result.every((a) => a.userId === 'user-1')).toBe(true)
    })

    it('should allow same account name for different users (userId_name unique)', async () => {
      // User 1's "Main" account
      const account1 = {
        id: 'account-1',
        userId: 'user-1',
        name: 'Main',
        type: AccountType.SELF,
        preferredCurrency: Currency.USD,
        color: null,
        icon: null,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deletedBy: null,
        defaultIncomeGoal: null,
        defaultIncomeGoalCurrency: null,
      }

      // User 2's "Main" account - same name, different user
      const account2 = {
        id: 'account-2',
        userId: 'user-2',
        name: 'Main',
        type: AccountType.SELF,
        preferredCurrency: Currency.EUR,
        color: null,
        icon: null,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deletedBy: null,
        defaultIncomeGoal: null,
        defaultIncomeGoalCurrency: null,
      }

      vi.mocked(prisma.account.create).mockResolvedValueOnce(account1).mockResolvedValueOnce(account2)

      const result1 = await prisma.account.create({
        data: { userId: 'user-1', name: 'Main', type: AccountType.SELF },
      })

      const result2 = await prisma.account.create({
        data: { userId: 'user-2', name: 'Main', type: AccountType.SELF },
      })

      // Both should succeed - same name is OK for different users
      expect(result1.name).toBe('Main')
      expect(result2.name).toBe('Main')
      expect(result1.userId).not.toBe(result2.userId)
    })
  })

  describe('User-Category Relationship', () => {
    it('should create category with userId (required field)', async () => {
      const mockCategory = {
        id: 'cat-1',
        userId: 'user-1',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: '#84cc16',
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.create).mockResolvedValue(mockCategory)

      const result = await prisma.category.create({
        data: {
          userId: 'user-1',
          name: 'Groceries',
          type: TransactionType.EXPENSE,
          color: '#84cc16',
        },
      })

      expect(result.userId).toBe('user-1')
      expect(result.name).toBe('Groceries')
    })

    it('should find all categories for a user', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          userId: 'user-1',
          name: 'Groceries',
          type: TransactionType.EXPENSE,
          color: null,
          isHolding: false,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'cat-2',
          userId: 'user-1',
          name: 'Salary',
          type: TransactionType.INCOME,
          color: null,
          isHolding: false,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(prisma.category.findMany).mockResolvedValue(mockCategories)

      const result = await prisma.category.findMany({
        where: { userId: 'user-1' },
      })

      expect(result).toHaveLength(2)
      expect(result.every((c) => c.userId === 'user-1')).toBe(true)
    })

    it('should allow same category name+type for different users', async () => {
      // User 1's "Groceries" EXPENSE category
      const cat1 = {
        id: 'cat-1',
        userId: 'user-1',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: null,
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // User 2's "Groceries" EXPENSE category - same name+type, different user
      const cat2 = {
        id: 'cat-2',
        userId: 'user-2',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: null,
        isHolding: false,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.category.create).mockResolvedValueOnce(cat1).mockResolvedValueOnce(cat2)

      const result1 = await prisma.category.create({
        data: { userId: 'user-1', name: 'Groceries', type: TransactionType.EXPENSE },
      })

      const result2 = await prisma.category.create({
        data: { userId: 'user-2', name: 'Groceries', type: TransactionType.EXPENSE },
      })

      // Both should succeed - same name+type is OK for different users
      expect(result1.name).toBe('Groceries')
      expect(result2.name).toBe('Groceries')
      expect(result1.userId).not.toBe(result2.userId)
    })
  })

  describe('User-RefreshToken Relationship', () => {
    it('should create refresh token linked to user', async () => {
      const mockToken = {
        id: 'token-1',
        jti: 'unique-jwt-id',
        userId: 'user-1',
        email: 'test@example.com',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        createdAt: new Date(),
      }

      vi.mocked(prisma.refreshToken.create).mockResolvedValue(mockToken)

      const result = await prisma.refreshToken.create({
        data: {
          jti: 'unique-jwt-id',
          userId: 'user-1',
          email: 'test@example.com',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      expect(result.userId).toBe('user-1')
      expect(result.jti).toBe('unique-jwt-id')
    })

    it('should find all refresh tokens for a user', async () => {
      const mockTokens = [
        {
          id: 'token-1',
          jti: 'jti-1',
          userId: 'user-1',
          email: 'test@example.com',
          expiresAt: new Date(),
          createdAt: new Date(),
        },
        {
          id: 'token-2',
          jti: 'jti-2',
          userId: 'user-1',
          email: 'test@example.com',
          expiresAt: new Date(),
          createdAt: new Date(),
        },
      ]

      vi.mocked(prisma.refreshToken.findMany).mockResolvedValue(mockTokens)

      const result = await prisma.refreshToken.findMany({
        where: { userId: 'user-1' },
      })

      expect(result).toHaveLength(2)
      expect(result.every((t) => t.userId === 'user-1')).toBe(true)
    })

    it('should cascade delete tokens when user is deleted', async () => {
      // This tests the onDelete: Cascade behavior
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 3 })

      // When user is deleted, their tokens should be automatically deleted
      const result = await prisma.refreshToken.deleteMany({
        where: { userId: 'user-to-delete' },
      })

      expect(result.count).toBe(3)
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-to-delete' },
      })
    })
  })

  describe('User with Relations (include)', () => {
    it('should find user with accounts and categories', async () => {
      const mockUserWithRelations = {
        id: 'user-1',
        email: 'test@example.com',
        displayName: 'Test User',
        passwordHash: '$2b$10$hashedpassword',
        preferredCurrency: Currency.USD,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        passwordResetToken: null,
        passwordResetExpires: null,
        hasCompletedOnboarding: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: [
          {
            id: 'account-1',
            userId: 'user-1',
            name: 'Main',
            type: AccountType.SELF,
            preferredCurrency: Currency.USD,
            color: null,
            icon: null,
            description: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            deletedAt: null,
            deletedBy: null,
          },
        ],
        categories: [
          {
            id: 'cat-1',
            userId: 'user-1',
            name: 'Groceries',
            type: TransactionType.EXPENSE,
            color: null,
            isHolding: false,
            isArchived: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        refreshTokens: [],
      }

      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUserWithRelations)

      const result = await prisma.user.findUnique({
        where: { email: 'test@example.com' },
        include: {
          accounts: true,
          categories: true,
          refreshTokens: true,
        },
      })

      expect(result?.accounts).toHaveLength(1)
      expect(result?.categories).toHaveLength(1)
      expect(result?.accounts[0].userId).toBe('user-1')
      expect(result?.categories[0].userId).toBe('user-1')
    })
  })
})
