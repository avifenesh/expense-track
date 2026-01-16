/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  shareExpenseAction,
  markSharePaidAction,
  cancelSharedExpenseAction,
  declineShareAction,
  lookupUserForSharingAction,
  sendPaymentReminderAction,
} from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Currency, SplitType, PaymentStatus } from '@prisma/client'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  requireSession: vi.fn(),
  getDbUserAsAuthUser: vi.fn(),
}))

vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn().mockResolvedValue(true),
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

vi.mock('@/lib/email', () => ({
  sendExpenseSharedEmail: vi.fn().mockResolvedValue({ success: true }),
  sendPaymentReminderEmail: vi.fn().mockResolvedValue({ success: true }),
}))

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
    transaction: {
      findUnique: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    sharedExpense: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    expenseParticipant: {
      createMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

const mockAuthUser = {
  email: 'owner@example.com',
  id: 'user-owner',
  displayName: 'Owner User',
  passwordHash: 'hash',
  preferredCurrency: Currency.USD,
  hasCompletedOnboarding: true,
  accountNames: ['Account1'],
  defaultAccountName: 'Account1',
}

describe('shareExpenseAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when session is missing', async () => {
    const { requireSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockRejectedValue(new Error('Unauthorized'))

    const result = await shareExpenseAction({
      transactionId: 'tx-1',
      splitType: SplitType.EQUAL,
      participants: [{ email: 'friend@example.com' }],
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
  })

  it('should fail when transaction not found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null)

    const result = await shareExpenseAction({
      transactionId: 'tx-nonexistent',
      splitType: SplitType.EQUAL,
      participants: [{ email: 'friend@example.com' }],
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Transaction not found')
    }
  })

  it('should fail when transaction belongs to another user', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      account: { userId: 'other-user' },
      sharedExpense: null,
    } as any)

    const result = await shareExpenseAction({
      transactionId: 'tx-1',
      splitType: SplitType.EQUAL,
      participants: [{ email: 'friend@example.com' }],
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('You do not have access to this transaction')
    }
  })

  it('should fail when transaction is already shared', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      account: { userId: 'user-owner' },
      sharedExpense: { id: 'shared-1' },
    } as any)

    const result = await shareExpenseAction({
      transactionId: 'tx-1',
      splitType: SplitType.EQUAL,
      participants: [{ email: 'friend@example.com' }],
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('This transaction is already shared')
    }
  })

  it('should fail when sharing with yourself', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      account: { userId: 'user-owner' },
      sharedExpense: null,
      amount: { toNumber: () => 100 },
      currency: Currency.USD,
    } as any)

    const result = await shareExpenseAction({
      transactionId: 'tx-1',
      splitType: SplitType.EQUAL,
      participants: [{ email: 'owner@example.com' }],
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('You cannot share an expense with yourself')
    }
  })

  it('should fail when participant user not found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx-1',
      account: { userId: 'user-owner' },
      sharedExpense: null,
      amount: { toNumber: () => 100 },
      currency: Currency.USD,
    } as any)
    vi.mocked(prisma.user.findMany).mockResolvedValue([])

    const result = await shareExpenseAction({
      transactionId: 'tx-1',
      splitType: SplitType.EQUAL,
      participants: [{ email: 'nonexistent@example.com' }],
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.participants?.[0]).toContain('Users not found')
    }
  })
})

describe('markSharePaidAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when participant not found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue(null)

    const result = await markSharePaidAction({
      participantId: 'part-nonexistent',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Participant record not found')
    }
  })

  it('should fail when user is not the owner', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      id: 'part-1',
      sharedExpense: { ownerId: 'other-user' },
      status: PaymentStatus.PENDING,
    } as any)

    const result = await markSharePaidAction({
      participantId: 'part-1',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('expense owner'))).toBe(true)
    }
  })

  it('should fail when share is already paid', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      id: 'part-1',
      sharedExpense: { ownerId: 'user-owner' },
      status: PaymentStatus.PAID,
    } as any)

    const result = await markSharePaidAction({
      participantId: 'part-1',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('already marked as paid'))).toBe(true)
    }
  })

  it('should succeed for valid request', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      id: 'part-1',
      sharedExpense: { ownerId: 'user-owner' },
      status: PaymentStatus.PENDING,
    } as any)
    vi.mocked(prisma.expenseParticipant.update).mockResolvedValue({} as any)

    const result = await markSharePaidAction({
      participantId: 'part-1',
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
  })
})

describe('cancelSharedExpenseAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when shared expense not found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.sharedExpense.findUnique).mockResolvedValue(null)

    const result = await cancelSharedExpenseAction({
      sharedExpenseId: 'shared-nonexistent',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Shared expense not found')
    }
  })

  it('should fail when user is not the owner', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.sharedExpense.findUnique).mockResolvedValue({
      id: 'shared-1',
      ownerId: 'other-user',
    } as any)

    const result = await cancelSharedExpenseAction({
      sharedExpenseId: 'shared-1',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('expense owner'))).toBe(true)
    }
  })

  it('should succeed for valid request', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.sharedExpense.findUnique).mockResolvedValue({
      id: 'shared-1',
      ownerId: 'user-owner',
    } as any)
    vi.mocked(prisma.sharedExpense.delete).mockResolvedValue({} as any)

    const result = await cancelSharedExpenseAction({
      sharedExpenseId: 'shared-1',
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
  })
})

describe('declineShareAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when participant not found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue(null)

    const result = await declineShareAction({
      participantId: 'part-nonexistent',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Participant record not found')
    }
  })

  it('should fail when declining others share', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      id: 'part-1',
      userId: 'other-user',
      status: PaymentStatus.PENDING,
    } as any)

    const result = await declineShareAction({
      participantId: 'part-1',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('You can only decline shares assigned to you')
    }
  })

  it('should fail when share is not pending', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      id: 'part-1',
      userId: 'user-owner',
      status: PaymentStatus.PAID,
    } as any)

    const result = await declineShareAction({
      participantId: 'part-1',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.[0]).toContain('Cannot decline')
    }
  })
})

describe('lookupUserForSharingAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when looking up yourself', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)

    const result = await lookupUserForSharingAction({
      email: 'owner@example.com',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('cannot share expenses with yourself'))).toBe(
        true,
      )
    }
  })

  it('should fail when user not found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = await lookupUserForSharingAction({
      email: 'nonexistent@example.com',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('No user found'))).toBe(true)
    }
  })

  it('should return user info when found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-friend',
      email: 'friend@example.com',
      displayName: 'Friend User',
    } as any)

    const result = await lookupUserForSharingAction({
      email: 'friend@example.com',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(false)
    if (!('error' in result)) {
      expect(result.data.user.email).toBe('friend@example.com')
      expect(result.data.user.displayName).toBe('Friend User')
    }
  })
})

describe('sendPaymentReminderAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fail when participant not found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue(null)

    const result = await sendPaymentReminderAction({
      participantId: 'part-nonexistent',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Participant record not found')
    }
  })

  it('should fail when user is not the owner', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      id: 'part-1',
      participant: { email: 'friend@example.com', displayName: 'Friend' },
      sharedExpense: {
        ownerId: 'other-user',
        currency: Currency.USD,
        description: 'Dinner',
        transaction: { description: 'Restaurant' },
      },
      shareAmount: { toNumber: () => 50 },
      status: PaymentStatus.PENDING,
      reminderSentAt: null,
    } as any)

    const result = await sendPaymentReminderAction({
      participantId: 'part-1',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Only the expense owner can send reminders')
    }
  })

  it('should fail when share is not pending', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      id: 'part-1',
      participant: { email: 'friend@example.com', displayName: 'Friend' },
      sharedExpense: {
        ownerId: 'user-owner',
        currency: Currency.USD,
        description: 'Dinner',
        transaction: { description: 'Restaurant' },
      },
      shareAmount: { toNumber: () => 50 },
      status: PaymentStatus.PAID,
      reminderSentAt: null,
    } as any)

    const result = await sendPaymentReminderAction({
      participantId: 'part-1',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.[0]).toContain('Cannot send reminder')
    }
  })

  it('should fail when reminder sent within 24 hours', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue(mockAuthUser)
    vi.mocked(prisma.expenseParticipant.findUnique).mockResolvedValue({
      id: 'part-1',
      participant: { email: 'friend@example.com', displayName: 'Friend' },
      sharedExpense: {
        ownerId: 'user-owner',
        currency: Currency.USD,
        description: 'Dinner',
        transaction: { description: 'Restaurant' },
      },
      shareAmount: { toNumber: () => 50 },
      status: PaymentStatus.PENDING,
      reminderSentAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
    } as any)

    const result = await sendPaymentReminderAction({
      participantId: 'part-1',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general?.some((msg: string) => msg.includes('reminder per day'))).toBe(true)
    }
  })
})
