/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createCategoryAction, archiveCategoryAction } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { TransactionType } from '@prisma/client'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn().mockResolvedValue(true),
  rotateCsrfToken: vi.fn().mockResolvedValue('new-token'),
}))

vi.mock('@/lib/auth-server', () => ({
  requireSession: vi.fn().mockResolvedValue({ userEmail: 'test@example.com', accountId: 'acc-1' }),
  getDbUserAsAuthUser: vi.fn().mockResolvedValue({
    id: 'test-user',
    email: 'test@example.com',
    displayName: 'Test User',
    passwordHash: 'hashed',
    accountNames: ['TestAccount'],
    defaultAccountName: 'TestAccount',
    preferredCurrency: 'USD',
    hasCompletedOnboarding: true,
  }),
}))

vi.mock('@/lib/subscription', () => ({
  hasActiveSubscription: vi.fn().mockResolvedValue(true),
  getSubscriptionState: vi.fn().mockResolvedValue({
    status: 'ACTIVE',
    isActive: true,
    trialEndsAt: null,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    daysRemaining: 30,
    canAccessApp: true,
  }),
}))

vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return {
    ...original,
    TransactionType: {
      INCOME: 'INCOME',
      EXPENSE: 'EXPENSE',
    },
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    category: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('createCategoryAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully create a category', async () => {
    vi.mocked(prisma.category.create).mockResolvedValue({
      id: 'cat-1',
      name: 'Groceries',
      type: TransactionType.EXPENSE,
      color: '#FF0000',
      isArchived: false,
      isHolding: false,
    } as any)

    const result = await createCategoryAction({
      name: 'Groceries',
      type: TransactionType.EXPENSE,
      color: '#FF0000',
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: {
        userId: 'test-user',
        name: 'Groceries',
        type: TransactionType.EXPENSE,
        color: '#FF0000',
      },
    })
  })

  it('should handle null color', async () => {
    vi.mocked(prisma.category.create).mockResolvedValue({
      id: 'cat-2',
      name: 'Salary',
      type: TransactionType.INCOME,
      color: null,
      isArchived: false,
      isHolding: false,
    } as any)

    const result = await createCategoryAction({
      name: 'Salary',
      type: TransactionType.INCOME,
      color: null,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.category.create).toHaveBeenCalledWith({
      data: {
        userId: 'test-user',
        name: 'Salary',
        type: TransactionType.INCOME,
        color: null,
      },
    })
  })

  it('should reject category with name too short', async () => {
    const result = await createCategoryAction({
      name: 'A',
      type: TransactionType.EXPENSE,
      color: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.name).toBeDefined()
    }
  })

  it('should handle duplicate category error', async () => {
    vi.mocked(prisma.category.create).mockRejectedValue(new Error('Unique constraint'))

    const result = await createCategoryAction({
      name: 'Groceries',
      type: TransactionType.EXPENSE,
      color: null,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Unable to create category')
    }
  })

  it('should create INCOME category', async () => {
    vi.mocked(prisma.category.create).mockResolvedValue({
      id: 'cat-3',
      name: 'Freelance',
      type: TransactionType.INCOME,
      color: '#00FF00',
      isArchived: false,
      isHolding: false,
    } as any)

    const result = await createCategoryAction({
      name: 'Freelance',
      type: TransactionType.INCOME,
      color: '#00FF00',
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
  })
})

describe('archiveCategoryAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should successfully archive a category', async () => {
    vi.mocked(prisma.category.update).mockResolvedValue({
      id: 'cat-1',
      name: 'Groceries',
      type: TransactionType.EXPENSE,
      color: '#FF0000',
      isArchived: true,
      isHolding: false,
    } as any)

    const result = await archiveCategoryAction({
      id: 'cat-1',
      isArchived: true,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'cat-1', userId: 'test-user' },
      data: { isArchived: true },
    })
  })

  it('should successfully unarchive a category', async () => {
    vi.mocked(prisma.category.update).mockResolvedValue({
      id: 'cat-1',
      name: 'Groceries',
      type: TransactionType.EXPENSE,
      color: '#FF0000',
      isArchived: false,
      isHolding: false,
    } as any)

    const result = await archiveCategoryAction({
      id: 'cat-1',
      isArchived: false,
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.category.update).toHaveBeenCalledWith({
      where: { id: 'cat-1', userId: 'test-user' },
      data: { isArchived: false },
    })
  })

  it('should handle category not found error', async () => {
    vi.mocked(prisma.category.update).mockRejectedValue(new Error('Not found'))

    const result = await archiveCategoryAction({
      id: 'nonexistent-id',
      isArchived: true,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Unable to update category')
    }
  })

  it('should reject missing id', async () => {
    const result = await archiveCategoryAction({
      id: '',
      isArchived: true,
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.id).toBeDefined()
    }
  })
})
