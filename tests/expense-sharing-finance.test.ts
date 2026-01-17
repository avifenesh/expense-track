/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { Currency, SplitType, PaymentStatus } from '@prisma/client'
import { getSharedExpenses, getExpensesSharedWithMe, getSettlementBalance } from '@/lib/finance'

vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return {
    ...original,
    Currency: {
      USD: 'USD',
      EUR: 'EUR',
      ILS: 'ILS',
    },
    SplitType: {
      EQUAL: 'EQUAL',
      PERCENTAGE: 'PERCENTAGE',
      FIXED: 'FIXED',
    },
    PaymentStatus: {
      PENDING: 'PENDING',
      PAID: 'PAID',
      DECLINED: 'DECLINED',
    },
    Prisma: {
      Decimal: class {
        constructor(public value: any) {}
        toNumber() {
          return Number(this.value)
        }
      },
    },
  }
})

vi.mock('@/lib/prisma', () => ({
  prisma: {
    sharedExpense: {
      findMany: vi.fn(),
    },
    expenseParticipant: {
      findMany: vi.fn(),
    },
  },
}))

describe('getSharedExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty array when no shared expenses', async () => {
    vi.mocked(prisma.sharedExpense.findMany).mockResolvedValue([])

    const result = await getSharedExpenses('user-1')

    expect(result.items).toEqual([])
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
    expect(prisma.sharedExpense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { ownerId: 'user-1' },
      }),
    )
  })

  it('should transform shared expenses correctly', async () => {
    vi.mocked(prisma.sharedExpense.findMany).mockResolvedValue([
      {
        id: 'shared-1',
        transactionId: 'tx-1',
        splitType: SplitType.EQUAL,
        totalAmount: { toNumber: () => 100 },
        currency: Currency.USD,
        description: 'Dinner',
        createdAt: new Date('2026-01-15'),
        transaction: {
          id: 'tx-1',
          date: new Date('2026-01-14'),
          description: 'Restaurant',
          category: { id: 'cat-1', name: 'Food' },
        },
        participants: [
          {
            id: 'part-1',
            shareAmount: { toNumber: () => 50 },
            sharePercentage: null,
            status: PaymentStatus.PENDING,
            paidAt: null,
            reminderSentAt: null,
            participant: {
              id: 'user-friend',
              email: 'friend@example.com',
              displayName: 'Friend User',
            },
          },
        ],
      },
    ] as any)

    const result = await getSharedExpenses('user-1')

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'shared-1',
      transactionId: 'tx-1',
      splitType: SplitType.EQUAL,
      totalAmount: 100,
      currency: Currency.USD,
      description: 'Dinner',
      totalOwed: 50,
      totalPaid: 0,
      allSettled: false,
    })
    expect(result.items[0].participants).toHaveLength(1)
    expect(result.items[0].participants[0]).toMatchObject({
      id: 'part-1',
      shareAmount: 50,
      status: PaymentStatus.PENDING,
    })
  })

  it('should calculate totals correctly with multiple participants', async () => {
    vi.mocked(prisma.sharedExpense.findMany).mockResolvedValue([
      {
        id: 'shared-1',
        transactionId: 'tx-1',
        splitType: SplitType.EQUAL,
        totalAmount: { toNumber: () => 150 },
        currency: Currency.USD,
        description: 'Dinner',
        createdAt: new Date('2026-01-15'),
        transaction: {
          id: 'tx-1',
          date: new Date('2026-01-14'),
          description: 'Restaurant',
          category: { id: 'cat-1', name: 'Food' },
        },
        participants: [
          {
            id: 'part-1',
            shareAmount: { toNumber: () => 50 },
            sharePercentage: null,
            status: PaymentStatus.PAID,
            paidAt: new Date(),
            reminderSentAt: null,
            participant: {
              id: 'user-friend1',
              email: 'friend1@example.com',
              displayName: 'Friend 1',
            },
          },
          {
            id: 'part-2',
            shareAmount: { toNumber: () => 50 },
            sharePercentage: null,
            status: PaymentStatus.PENDING,
            paidAt: null,
            reminderSentAt: null,
            participant: {
              id: 'user-friend2',
              email: 'friend2@example.com',
              displayName: 'Friend 2',
            },
          },
        ],
      },
    ] as any)

    const result = await getSharedExpenses('user-1')

    expect(result.items[0].totalOwed).toBe(50) // Only pending
    expect(result.items[0].totalPaid).toBe(50) // Only paid
    expect(result.items[0].allSettled).toBe(false)
  })

  it('should mark allSettled true when all participants paid or declined', async () => {
    vi.mocked(prisma.sharedExpense.findMany).mockResolvedValue([
      {
        id: 'shared-1',
        transactionId: 'tx-1',
        splitType: SplitType.EQUAL,
        totalAmount: { toNumber: () => 100 },
        currency: Currency.USD,
        description: 'Dinner',
        createdAt: new Date('2026-01-15'),
        transaction: {
          id: 'tx-1',
          date: new Date('2026-01-14'),
          description: 'Restaurant',
          category: { id: 'cat-1', name: 'Food' },
        },
        participants: [
          {
            id: 'part-1',
            shareAmount: { toNumber: () => 50 },
            sharePercentage: null,
            status: PaymentStatus.PAID,
            paidAt: new Date(),
            reminderSentAt: null,
            participant: {
              id: 'user-friend',
              email: 'friend@example.com',
              displayName: 'Friend User',
            },
          },
        ],
      },
    ] as any)

    const result = await getSharedExpenses('user-1')

    expect(result.items[0].allSettled).toBe(true)
  })
})

describe('getExpensesSharedWithMe', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty array when no participations', async () => {
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([])

    const result = await getExpensesSharedWithMe('user-1')

    expect(result.items).toEqual([])
    expect(result.hasMore).toBe(false)
    expect(result.nextCursor).toBeNull()
    expect(prisma.expenseParticipant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
      }),
    )
  })

  it('should transform participations correctly', async () => {
    vi.mocked(prisma.expenseParticipant.findMany).mockResolvedValue([
      {
        id: 'part-1',
        shareAmount: { toNumber: () => 50 },
        sharePercentage: { toNumber: () => 50 },
        status: PaymentStatus.PENDING,
        paidAt: null,
        sharedExpense: {
          id: 'shared-1',
          splitType: SplitType.PERCENTAGE,
          totalAmount: { toNumber: () => 100 },
          currency: Currency.USD,
          description: 'Movie tickets',
          createdAt: new Date('2026-01-15'),
          transaction: {
            id: 'tx-1',
            date: new Date('2026-01-14'),
            description: 'Cinema',
            category: { id: 'cat-1', name: 'Entertainment' },
          },
          owner: {
            id: 'user-owner',
            email: 'owner@example.com',
            displayName: 'Owner User',
          },
        },
      },
    ] as any)

    const result = await getExpensesSharedWithMe('user-1')

    expect(result.items).toHaveLength(1)
    expect(result.items[0]).toMatchObject({
      id: 'part-1',
      shareAmount: 50,
      sharePercentage: 50,
      status: PaymentStatus.PENDING,
      paidAt: null,
    })
    expect(result.items[0].sharedExpense).toMatchObject({
      id: 'shared-1',
      splitType: SplitType.PERCENTAGE,
      totalAmount: 100,
      currency: Currency.USD,
    })
    expect(result.items[0].sharedExpense.owner).toMatchObject({
      email: 'owner@example.com',
      displayName: 'Owner User',
    })
  })
})

describe('getSettlementBalance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return empty array when no balances', async () => {
    vi.mocked(prisma.expenseParticipant.findMany)
      .mockResolvedValueOnce([]) // shared by user
      .mockResolvedValueOnce([]) // shared with user

    const result = await getSettlementBalance('user-1')

    expect(result).toEqual([])
  })

  it('should calculate positive balance when others owe user', async () => {
    vi.mocked(prisma.expenseParticipant.findMany)
      .mockResolvedValueOnce([
        {
          id: 'part-1',
          shareAmount: { toNumber: () => 50 },
          participant: {
            id: 'user-friend',
            email: 'friend@example.com',
            displayName: 'Friend User',
          },
          sharedExpense: {
            currency: 'USD',
          },
        },
      ] as any) // shared by user - friend owes 50
      .mockResolvedValueOnce([]) // shared with user

    const result = await getSettlementBalance('user-1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      userId: 'user-friend',
      userEmail: 'friend@example.com',
      userDisplayName: 'Friend User',
      currency: 'USD',
      youOwe: 0,
      theyOwe: 50,
      netBalance: 50,
    })
  })

  it('should calculate negative balance when user owes others', async () => {
    vi.mocked(prisma.expenseParticipant.findMany)
      .mockResolvedValueOnce([]) // shared by user
      .mockResolvedValueOnce([
        {
          id: 'part-1',
          shareAmount: { toNumber: () => 75 },
          sharedExpense: {
            currency: 'USD',
            owner: {
              id: 'user-owner',
              email: 'owner@example.com',
              displayName: 'Owner User',
            },
          },
        },
      ] as any) // shared with user - owes 75

    const result = await getSettlementBalance('user-1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      userId: 'user-owner',
      userEmail: 'owner@example.com',
      userDisplayName: 'Owner User',
      currency: 'USD',
      youOwe: 75,
      theyOwe: 0,
      netBalance: -75,
    })
  })

  it('should calculate net balance with mutual debts', async () => {
    vi.mocked(prisma.expenseParticipant.findMany)
      .mockResolvedValueOnce([
        {
          id: 'part-1',
          shareAmount: { toNumber: () => 100 },
          participant: {
            id: 'user-friend',
            email: 'friend@example.com',
            displayName: 'Friend User',
          },
          sharedExpense: {
            currency: 'USD',
          },
        },
      ] as any) // friend owes user 100
      .mockResolvedValueOnce([
        {
          id: 'part-2',
          shareAmount: { toNumber: () => 30 },
          sharedExpense: {
            currency: 'USD',
            owner: {
              id: 'user-friend',
              email: 'friend@example.com',
              displayName: 'Friend User',
            },
          },
        },
      ] as any) // user owes friend 30

    const result = await getSettlementBalance('user-1')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      userId: 'user-friend',
      currency: 'USD',
      youOwe: 30,
      theyOwe: 100,
      netBalance: 70, // friend owes user net 70
    })
  })

  it('should sort by absolute net balance descending', async () => {
    vi.mocked(prisma.expenseParticipant.findMany)
      .mockResolvedValueOnce([
        {
          shareAmount: { toNumber: () => 20 },
          participant: { id: 'user-a', email: 'a@example.com', displayName: 'User A' },
          sharedExpense: { currency: 'USD' },
        },
        {
          shareAmount: { toNumber: () => 100 },
          participant: { id: 'user-b', email: 'b@example.com', displayName: 'User B' },
          sharedExpense: { currency: 'USD' },
        },
        {
          shareAmount: { toNumber: () => 50 },
          participant: { id: 'user-c', email: 'c@example.com', displayName: 'User C' },
          sharedExpense: { currency: 'USD' },
        },
      ] as any)
      .mockResolvedValueOnce([])

    const result = await getSettlementBalance('user-1')

    expect(result).toHaveLength(3)
    expect(result[0].userId).toBe('user-b') // 100
    expect(result[1].userId).toBe('user-c') // 50
    expect(result[2].userId).toBe('user-a') // 20
  })

  it('should group balances by currency - same user with different currencies', async () => {
    vi.mocked(prisma.expenseParticipant.findMany)
      .mockResolvedValueOnce([
        {
          shareAmount: { toNumber: () => 50 },
          participant: { id: 'user-friend', email: 'friend@example.com', displayName: 'Friend User' },
          sharedExpense: { currency: 'USD' },
        },
        {
          shareAmount: { toNumber: () => 30 },
          participant: { id: 'user-friend', email: 'friend@example.com', displayName: 'Friend User' },
          sharedExpense: { currency: 'EUR' },
        },
      ] as any)
      .mockResolvedValueOnce([])

    const result = await getSettlementBalance('user-1')

    // Should have 2 separate balances - one for USD, one for EUR
    expect(result).toHaveLength(2)
    const usdBalance = result.find((b) => b.currency === 'USD')
    const eurBalance = result.find((b) => b.currency === 'EUR')

    expect(usdBalance).toMatchObject({
      userId: 'user-friend',
      currency: 'USD',
      theyOwe: 50,
      youOwe: 0,
      netBalance: 50,
    })
    expect(eurBalance).toMatchObject({
      userId: 'user-friend',
      currency: 'EUR',
      theyOwe: 30,
      youOwe: 0,
      netBalance: 30,
    })
  })
})
