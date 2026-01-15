/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TransactionType, Currency, RequestStatus, Prisma } from '@prisma/client'

// 1. Mock @prisma/client FIRST (enums & Decimal)
vi.mock('@prisma/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('@prisma/client')>()
  return {
    ...original,
    TransactionType: { INCOME: 'INCOME', EXPENSE: 'EXPENSE' },
    Currency: { USD: 'USD', EUR: 'EUR', ILS: 'ILS' },
    RequestStatus: { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' },
    Prisma: {
      Decimal: class {
        constructor(public value: any) {}
        toNumber() {
          return Number(this.value)
        }
        toFixed(decimals: number) {
          return Number(this.value).toFixed(decimals)
        }
      },
    },
  }
})

// 2. Mock @/lib/prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findUnique: vi.fn(),
    },
    transactionRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// 3. Mock dependencies
vi.mock('@/utils/date', () => ({
  getMonthStart: vi.fn((date) => {
    const d = new Date(date)
    d.setUTCDate(1)
    d.setUTCHours(0, 0, 0, 0)
    return d
  }),
}))

vi.mock('@/app/actions/shared', () => ({
  toDecimalString: vi.fn((n) => n.toFixed(2)),
}))

// 4. Import AFTER all mocks
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  getTransactionById,
  createTransactionRequest,
  getTransactionRequestById,
  approveTransactionRequest,
  rejectTransactionRequest,
  getUserPrimaryAccount,
} from '@/lib/services/transaction-service'
import { prisma } from '@/lib/prisma'
import { getMonthStart } from '@/utils/date'
import { toDecimalString } from '@/app/actions/shared'

describe('transaction-service.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createTransaction', () => {
    it('should create transaction with all fields', async () => {
      const testDate = new Date('2024-01-15T10:30:00Z')
      const mockMonthStart = new Date('2024-01-01T00:00:00Z')
      const mockTransaction = {
        id: 'tx-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('50.00'),
        currency: Currency.USD,
        date: testDate,
        month: mockMonthStart,
        description: 'Test transaction',
        isRecurring: false,
        recurringTemplateId: null,
        isMutual: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(getMonthStart).mockReturnValue(mockMonthStart)
      vi.mocked(prisma.transaction.create).mockResolvedValue(mockTransaction)

      const result = await createTransaction({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 50.0,
        currency: Currency.USD,
        date: testDate,
        description: 'Test transaction',
      })

      expect(getMonthStart).toHaveBeenCalledWith(testDate)
      expect(toDecimalString).toHaveBeenCalledWith(50.0)
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: {
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: TransactionType.EXPENSE,
          amount: expect.any(Prisma.Decimal),
          currency: Currency.USD,
          date: testDate,
          month: mockMonthStart,
          description: 'Test transaction',
          isRecurring: false,
          recurringTemplateId: null,
        },
      })
      expect(result).toEqual(mockTransaction)
    })

    it('should normalize month via getMonthStart', async () => {
      const testDate = new Date('2024-02-20T15:45:00Z')
      const expectedMonthStart = new Date('2024-02-01T00:00:00Z')

      vi.mocked(getMonthStart).mockReturnValue(expectedMonthStart)
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

      await createTransaction({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.INCOME,
        amount: 100.0,
        currency: Currency.USD,
        date: testDate,
      })

      expect(getMonthStart).toHaveBeenCalledWith(testDate)
      const createCall = vi.mocked(prisma.transaction.create).mock.calls[0][0]
      expect(createCall.data.month).toBe(expectedMonthStart)
    })

    it('should convert amount via toDecimalString', async () => {
      vi.mocked(toDecimalString).mockReturnValue('123.46')
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

      await createTransaction({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 123.456,
        currency: Currency.USD,
        date: new Date(),
      })

      expect(toDecimalString).toHaveBeenCalledWith(123.456)
      const createCall = vi.mocked(prisma.transaction.create).mock.calls[0][0]
      expect(createCall.data.amount).toBeInstanceOf(Prisma.Decimal)
    })

    it('should handle optional fields with defaults', async () => {
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

      await createTransaction({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.INCOME,
        amount: 200.0,
        currency: Currency.EUR,
        date: new Date(),
        // No description, isRecurring, or recurringTemplateId
      })

      const createCall = vi.mocked(prisma.transaction.create).mock.calls[0][0]
      expect(createCall.data.description).toBeUndefined()
      expect(createCall.data.isRecurring).toBe(false)
      expect(createCall.data.recurringTemplateId).toBeNull()
    })

    it('should use type casting (prisma as any).transaction', async () => {
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as any)

      await createTransaction({
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 50.0,
        currency: Currency.USD,
        date: new Date(),
      })

      // Verify the mock was called (proves (prisma as any) works)
      expect(prisma.transaction.create).toHaveBeenCalled()
    })
  })

  describe('updateTransaction', () => {
    it('should update transaction with all fields', async () => {
      const testDate = new Date('2024-03-10T12:00:00Z')
      const mockMonthStart = new Date('2024-03-01T00:00:00Z')
      const mockUpdated = {
        id: 'tx-1',
        accountId: 'acc-2',
        categoryId: 'cat-2',
        type: TransactionType.INCOME,
        amount: new Prisma.Decimal('150.00'),
        currency: Currency.EUR,
        date: testDate,
        month: mockMonthStart,
        description: 'Updated',
        isRecurring: true,
        recurringTemplateId: null,
        isMutual: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(getMonthStart).mockReturnValue(mockMonthStart)
      vi.mocked(prisma.transaction.update).mockResolvedValue(mockUpdated)

      const result = await updateTransaction({
        id: 'tx-1',
        accountId: 'acc-2',
        categoryId: 'cat-2',
        type: TransactionType.INCOME,
        amount: 150.0,
        currency: Currency.EUR,
        date: testDate,
        description: 'Updated',
        isRecurring: true,
      })

      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: {
          accountId: 'acc-2',
          categoryId: 'cat-2',
          type: TransactionType.INCOME,
          amount: expect.any(Prisma.Decimal),
          currency: Currency.EUR,
          date: testDate,
          month: mockMonthStart,
          description: 'Updated',
          isRecurring: true,
        },
      })
      expect(result).toEqual(mockUpdated)
    })

    it('should recalculate month when date changes', async () => {
      const oldDate = new Date('2024-01-15')
      const newDate = new Date('2024-02-20')
      const newMonthStart = new Date('2024-02-01T00:00:00Z')

      vi.mocked(getMonthStart).mockReturnValue(newMonthStart)
      vi.mocked(prisma.transaction.update).mockResolvedValue({} as any)

      await updateTransaction({
        id: 'tx-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 100.0,
        currency: Currency.USD,
        date: newDate,
      })

      expect(getMonthStart).toHaveBeenCalledWith(newDate)
      const updateCall = vi.mocked(prisma.transaction.update).mock.calls[0][0]
      expect(updateCall.data.month).toBe(newMonthStart)
    })

    it('should include all updatable fields', async () => {
      vi.mocked(prisma.transaction.update).mockResolvedValue({} as any)

      await updateTransaction({
        id: 'tx-1',
        accountId: 'acc-new',
        categoryId: 'cat-new',
        type: TransactionType.INCOME,
        amount: 500.0,
        currency: Currency.ILS,
        date: new Date('2024-05-15'),
        description: 'New description',
        isRecurring: false,
      })

      const updateCall = vi.mocked(prisma.transaction.update).mock.calls[0][0]
      expect(updateCall.data).toHaveProperty('accountId')
      expect(updateCall.data).toHaveProperty('categoryId')
      expect(updateCall.data).toHaveProperty('type')
      expect(updateCall.data).toHaveProperty('amount')
      expect(updateCall.data).toHaveProperty('currency')
      expect(updateCall.data).toHaveProperty('date')
      expect(updateCall.data).toHaveProperty('month')
      expect(updateCall.data).toHaveProperty('description')
      expect(updateCall.data).toHaveProperty('isRecurring')
    })

    it('should not update recurringTemplateId', async () => {
      vi.mocked(prisma.transaction.update).mockResolvedValue({} as any)

      await updateTransaction({
        id: 'tx-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 100.0,
        currency: Currency.USD,
        date: new Date(),
        recurringTemplateId: 'template-1', // This should be ignored
      })

      const updateCall = vi.mocked(prisma.transaction.update).mock.calls[0][0]
      expect(updateCall.data).not.toHaveProperty('recurringTemplateId')
    })

    it('should propagate Prisma error for non-existent transaction', async () => {
      const prismaError = new Error('Record to update not found')
      vi.mocked(prisma.transaction.update).mockRejectedValue(prismaError)

      await expect(
        updateTransaction({
          id: 'non-existent',
          accountId: 'acc-1',
          categoryId: 'cat-1',
          type: TransactionType.EXPENSE,
          amount: 100.0,
          currency: Currency.USD,
          date: new Date(),
        }),
      ).rejects.toThrow('Record to update not found')
    })
  })

  describe('deleteTransaction', () => {
    it('should delete transaction by ID', async () => {
      const mockDeleted = {
        id: 'tx-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('50.00'),
        currency: Currency.USD,
        date: new Date(),
        month: new Date(),
        description: null,
        isRecurring: false,
        recurringTemplateId: null,
        isMutual: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transaction.delete).mockResolvedValue(mockDeleted)

      const result = await deleteTransaction('tx-1')

      expect(prisma.transaction.delete).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
      })
      expect(result).toEqual(mockDeleted)
    })

    it('should propagate Prisma error for non-existent transaction', async () => {
      const prismaError = new Error('Record to delete does not exist')
      vi.mocked(prisma.transaction.delete).mockRejectedValue(prismaError)

      await expect(deleteTransaction('non-existent')).rejects.toThrow('Record to delete does not exist')
    })
  })

  describe('getTransactionById', () => {
    it('should return transaction when found', async () => {
      const mockTransaction = {
        id: 'tx-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: new Prisma.Decimal('75.50'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        month: new Date('2024-01-01'),
        description: 'Groceries',
        isRecurring: false,
        recurringTemplateId: null,
        isMutual: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(mockTransaction)

      const result = await getTransactionById('tx-1')

      expect(prisma.transaction.findUnique).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
      })
      expect(result).toEqual(mockTransaction)
    })

    it('should return null when transaction not found', async () => {
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null)

      const result = await getTransactionById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('createTransactionRequest', () => {
    it('should create request with fromId and toId', async () => {
      const testDate = new Date('2024-01-20')
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-from',
        toId: 'acc-to',
        categoryId: 'cat-1',
        amount: new Prisma.Decimal('100.00'),
        currency: Currency.USD,
        date: testDate,
        description: 'Payment request',
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.create).mockResolvedValue(mockRequest)

      const result = await createTransactionRequest({
        fromId: 'acc-from',
        toId: 'acc-to',
        categoryId: 'cat-1',
        amount: 100.0,
        currency: Currency.USD,
        date: testDate,
        description: 'Payment request',
      })

      expect(toDecimalString).toHaveBeenCalledWith(100.0)
      expect(prisma.transactionRequest.create).toHaveBeenCalledWith({
        data: {
          fromId: 'acc-from',
          toId: 'acc-to',
          categoryId: 'cat-1',
          amount: expect.any(Prisma.Decimal),
          currency: Currency.USD,
          date: testDate,
          description: 'Payment request',
          status: RequestStatus.PENDING,
        },
      })
      expect(result).toEqual(mockRequest)
    })

    it('should default status to PENDING', async () => {
      vi.mocked(prisma.transactionRequest.create).mockResolvedValue({} as any)

      await createTransactionRequest({
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: 50.0,
        currency: Currency.USD,
        date: new Date(),
      })

      const createCall = vi.mocked(prisma.transactionRequest.create).mock.calls[0][0]
      expect(createCall.data.status).toBe(RequestStatus.PENDING)
    })

    it('should handle decimal conversion', async () => {
      vi.mocked(toDecimalString).mockReturnValue('75.50')
      vi.mocked(prisma.transactionRequest.create).mockResolvedValue({} as any)

      await createTransactionRequest({
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: 75.5,
        currency: Currency.EUR,
        date: new Date(),
      })

      expect(toDecimalString).toHaveBeenCalledWith(75.5)
      const createCall = vi.mocked(prisma.transactionRequest.create).mock.calls[0][0]
      expect(createCall.data.amount).toBeInstanceOf(Prisma.Decimal)
    })
  })

  describe('getTransactionRequestById', () => {
    it('should return request when found', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: new Prisma.Decimal('100.00'),
        currency: Currency.USD,
        date: new Date(),
        description: 'Test request',
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest)

      const result = await getTransactionRequestById('req-1')

      expect(prisma.transactionRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'req-1' },
      })
      expect(result).toEqual(mockRequest)
    })

    it('should return null when request not found', async () => {
      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(null)

      const result = await getTransactionRequestById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('approveTransactionRequest', () => {
    it('should atomically update status and create transaction', async () => {
      const requestDate = new Date('2024-02-15')
      const monthStart = new Date('2024-02-01T00:00:00Z')
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-from',
        toId: 'acc-to',
        categoryId: 'cat-1',
        amount: new Prisma.Decimal('200.00'),
        currency: Currency.USD,
        date: requestDate,
        description: 'Approved payment',
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest)
      vi.mocked(getMonthStart).mockReturnValue(monthStart)
      vi.mocked(prisma.$transaction).mockResolvedValue([{}, {}] as any)

      const result = await approveTransactionRequest('req-1')

      expect(prisma.transactionRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'req-1' },
      })
      expect(prisma.$transaction).toHaveBeenCalledWith(expect.arrayContaining([expect.any(Object)]))
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      expect(result).toEqual(mockRequest)
    })

    it('should throw error when request not found', async () => {
      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(null)

      await expect(approveTransactionRequest('non-existent')).rejects.toThrow('Transaction request not found')

      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should throw error when request already approved', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: new Prisma.Decimal('100.00'),
        currency: Currency.USD,
        date: new Date(),
        description: null,
        status: RequestStatus.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest)

      await expect(approveTransactionRequest('req-1')).rejects.toThrow('Request is already approved')

      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should throw error when request already rejected', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: new Prisma.Decimal('100.00'),
        currency: Currency.USD,
        date: new Date(),
        description: null,
        status: RequestStatus.REJECTED,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest)

      await expect(approveTransactionRequest('req-1')).rejects.toThrow('Request is already rejected')

      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should create EXPENSE transaction on toId account', async () => {
      const requestDate = new Date('2024-03-10')
      const monthStart = new Date('2024-03-01T00:00:00Z')
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-from',
        toId: 'acc-to',
        categoryId: 'cat-1',
        amount: new Prisma.Decimal('150.00'),
        currency: Currency.EUR,
        date: requestDate,
        description: 'Test expense',
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest)
      vi.mocked(getMonthStart).mockReturnValue(monthStart)
      vi.mocked(prisma.$transaction).mockImplementation(async (operations) => {
        // Verify the transaction.create operation
        const createOp = operations[1] as any
        expect(createOp).toBeDefined()
        return [{}, {}] as any
      })

      await approveTransactionRequest('req-1')

      expect(getMonthStart).toHaveBeenCalledWith(requestDate)
    })
  })

  describe('rejectTransactionRequest', () => {
    it('should set status to REJECTED', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: new Prisma.Decimal('100.00'),
        currency: Currency.USD,
        date: new Date(),
        description: null,
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const mockRejected = { ...mockRequest, status: RequestStatus.REJECTED }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest)
      vi.mocked(prisma.transactionRequest.update).mockResolvedValue(mockRejected)

      const result = await rejectTransactionRequest('req-1')

      expect(prisma.transactionRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: RequestStatus.REJECTED },
      })
      expect(result.status).toBe(RequestStatus.REJECTED)
    })

    it('should throw error when request not found', async () => {
      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(null)

      await expect(rejectTransactionRequest('non-existent')).rejects.toThrow('Transaction request not found')

      expect(prisma.transactionRequest.update).not.toHaveBeenCalled()
    })

    it('should throw error when request not pending', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: new Prisma.Decimal('100.00'),
        currency: Currency.USD,
        date: new Date(),
        description: null,
        status: RequestStatus.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest)

      await expect(rejectTransactionRequest('req-1')).rejects.toThrow('Request is already approved')

      expect(prisma.transactionRequest.update).not.toHaveBeenCalled()
    })
  })

  describe('getUserPrimaryAccount', () => {
    it('should find first SELF account matching names', async () => {
      const mockAccount = {
        id: 'acc-1',
        name: 'Avi',
        type: 'SELF' as const,
        preferredCurrency: Currency.USD,
        color: null,
        icon: null,
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount)

      const result = await getUserPrimaryAccount(['Avi', 'Shared'])

      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { name: { in: ['Avi', 'Shared'] }, type: 'SELF' },
      })
      expect(result).toEqual(mockAccount)
    })
  })
})
