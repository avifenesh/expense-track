/* eslint-disable @typescript-eslint/no-explicit-any -- Mock returns require any casts */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  createTransactionRequestAction,
  approveTransactionRequestAction,
  rejectTransactionRequestAction,
} from '@/app/actions'
import { prisma } from '@/lib/prisma'
import { Currency } from '@prisma/client'

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

vi.mock('@/lib/auth-server', () => ({
  requireSession: vi.fn(),
  getDbUserAsAuthUser: vi.fn(),
}))

vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return {
    ...original,
    RequestStatus: {
      PENDING: 'PENDING',
      APPROVED: 'APPROVED',
      REJECTED: 'REJECTED',
    },
    Currency: {
      USD: 'USD',
      EUR: 'EUR',
      ILS: 'ILS',
    },
    TransactionType: {
      INCOME: 'INCOME',
      EXPENSE: 'EXPENSE',
    },
    AccountType: {
      SELF: 'SELF',
      PARTNER: 'PARTNER',
      OTHER: 'OTHER',
    },
  }
})

vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn().mockResolvedValue(true),
  rotateCsrfToken: vi.fn().mockResolvedValue('new-token'),
}))

vi.mock('@/lib/dashboard-cache', () => ({
  invalidateDashboardCache: vi.fn().mockResolvedValue(undefined),
  invalidateAllDashboardCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((calls) => Promise.all(calls)),
    account: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    transactionRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    transaction: {
      create: vi.fn(),
    },
  },
}))

describe('createTransactionRequestAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fails if the session is missing', async () => {
    const { requireSession } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockRejectedValue(new Error('Unauthorized'))

    const result = await createTransactionRequestAction({
      toId: 'recipient-id',
      categoryId: 'cat-id',
      amount: 50,
      currency: Currency.USD,
      date: new Date(),
      description: 'Groceries',
      csrfToken: 'test-token',
    })

    expect('error' in result).toBe(true)
    if ('error' in result) {
      expect(result.error.general).toContain('Your session expired. Please sign in again.')
    }
  })

  it('successfully creates a request', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'avi@example.com',
      id: 'avi',
      displayName: 'Avi',
      passwordHash: 'mock-hash',
      preferredCurrency: Currency.USD,
      accountNames: ['Avi', 'Serena'],
      defaultAccountName: 'Avi',
    })

    vi.mocked(prisma.account.findFirst).mockResolvedValue({
      id: 'from-id',
      name: 'Avi',
      type: 'SELF',
    } as any)
    vi.mocked(prisma.transactionRequest.create).mockResolvedValue({} as any)

    const result = await createTransactionRequestAction({
      toId: 'to-id',
      categoryId: 'cat-id',
      amount: 100,
      currency: Currency.USD,
      date: new Date('2026-01-01'),
      description: 'Dinner',
      csrfToken: 'test-token',
    })

    expect(result).toEqual({ success: true })
    expect(prisma.transactionRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fromId: 'from-id',
          toId: 'to-id',
        }),
      }),
    )
  })
})

describe('approveTransactionRequestAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fails if the request is not found', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'serena@example.com',
      id: 'serena',
      displayName: 'Serena',
      passwordHash: 'mock-hash',
      preferredCurrency: Currency.EUR,
      accountNames: ['Serena'],
      defaultAccountName: 'Serena',
    })

    vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(null)

    const result = await approveTransactionRequestAction({ id: 'req-id', csrfToken: 'test-token' })

    expect(result).toEqual({ success: false, error: { general: ['Transaction request not found'] } })
  })

  it('successfully approves a request and creates a transaction', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'serena@example.com',
      id: 'serena',
      displayName: 'Serena',
      passwordHash: 'mock-hash',
      preferredCurrency: Currency.EUR,
      accountNames: ['Serena'],
      defaultAccountName: 'Serena',
    })

    const mockRequest = {
      id: 'req-id',
      toId: 'serena-id',
      fromId: 'avi-id',
      amount: 100,
      currency: 'EUR',
      categoryId: 'cat-id',
      description: 'Dinner',
      date: new Date(),
      status: 'PENDING',
    }

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'serena-id',
      name: 'Serena',
      type: 'SELF',
    } as any)
    vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as any)
    vi.mocked(prisma.transactionRequest.update).mockResolvedValue({} as any)
    vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

    const result = await approveTransactionRequestAction({ id: 'req-id', csrfToken: 'test-token' })

    expect(result).toEqual({ success: true })
    expect(prisma.transactionRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-id' },
      data: { status: 'APPROVED' },
    })
    expect(prisma.transaction.create).toHaveBeenCalled()
  })
})

describe('rejectTransactionRequestAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('successfully rejects a request', async () => {
    const { requireSession, getDbUserAsAuthUser } = await import('@/lib/auth-server')
    vi.mocked(requireSession).mockResolvedValue({} as any)
    vi.mocked(getDbUserAsAuthUser).mockResolvedValue({
      email: 'serena@example.com',
      id: 'serena',
      displayName: 'Serena',
      passwordHash: 'mock-hash',
      preferredCurrency: Currency.EUR,
      accountNames: ['Serena'],
      defaultAccountName: 'Serena',
    })

    const mockRequest = {
      id: 'req-id',
      toId: 'serena-id',
      fromId: 'avi-id',
      status: 'PENDING',
    }

    vi.mocked(prisma.account.findUnique).mockResolvedValue({
      id: 'serena-id',
      name: 'Serena',
      type: 'SELF',
    } as any)
    vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as any)
    vi.mocked(prisma.transactionRequest.update).mockResolvedValue({} as any)

    const result = await rejectTransactionRequestAction({ id: 'req-id', csrfToken: 'test-token' })

    expect(result).toEqual({ success: true })
    expect(prisma.transactionRequest.update).toHaveBeenCalledWith({
      where: { id: 'req-id' },
      data: { status: 'REJECTED' },
    })
  })
})
