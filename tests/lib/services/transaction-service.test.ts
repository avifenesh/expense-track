import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { TransactionType, RequestStatus, Currency } from '@prisma/client'

// Mock Prisma.Decimal
vi.mock('@prisma/client', async (importOriginal) => {
  const original = (await importOriginal()) as typeof import('@prisma/client')

  class MockDecimal {
    constructor(public value: string | number) {}
    toNumber() {
      return Number(this.value)
    }
    toString() {
      return String(this.value)
    }
  }

  return {
    ...original,
    Prisma: {
      ...original.Prisma,
      Decimal: MockDecimal,
    },
  }
})

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

vi.mock('@/utils/date', () => ({
  getMonthStart: vi.fn((date: Date) => {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  }),
}))

vi.mock('@/app/actions/shared', () => ({
  toDecimalString: vi.fn((value: number) => {
    const DECIMAL_PRECISION = 2
    const AMOUNT_SCALE = Math.pow(10, DECIMAL_PRECISION)
    return (Math.round(value * AMOUNT_SCALE) / AMOUNT_SCALE).toFixed(DECIMAL_PRECISION)
  }),
}))

// Import after mocks
import { prisma } from '@/lib/prisma'
import { getMonthStart } from '@/utils/date'
import { toDecimalString } from '@/app/actions/shared'
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
  type CreateTransactionInput,
  type UpdateTransactionInput,
  type CreateTransactionRequestInput,
} from '@/lib/services/transaction-service'

// Helper to create mock decimal objects
const mockDecimal = (value: string) => ({
  value,
  toNumber: () => Number(value),
  toString: () => value,
})

// Prisma error type
interface PrismaError extends Error {
  code: string
}

describe('transaction-service.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Phase 1: createTransaction()', () => {
    it('should create transaction with all fields', async () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 50.75,
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Grocery shopping',
        isRecurring: false,
        recurringTemplateId: null,
      }

      const mockTransaction = {
        id: 'txn-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('50.75'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        month: new Date('2024-01-01'),
        description: 'Grocery shopping',
        isRecurring: false,
        isMutual: false,
        recurringTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transaction.create).mockResolvedValue(mockTransaction as never)

      await createTransaction(input)

      expect(getMonthStart).toHaveBeenCalledWith(new Date('2024-01-15'))
      expect(toDecimalString).toHaveBeenCalledWith(50.75)
    })

    it('should create transaction without description', async () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.INCOME,
        amount: 1000,
        currency: Currency.USD,
        date: new Date('2024-01-15'),
      }

      const mockTransaction = {
        id: 'txn-2',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.INCOME,
        amount: mockDecimal('1000.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        month: new Date('2024-01-01'),
        description: null,
        isRecurring: false,
        isMutual: false,
        recurringTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transaction.create).mockResolvedValue(mockTransaction as never)

      await createTransaction(input)

      const call = vi.mocked(prisma.transaction.create).mock.calls[0][0]
      expect(call.data.description).toBeUndefined()
    })

    it('should calculate month from mid-month date', async () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: new Date('2024-03-25'),
      }

      const mockTransaction = {
        id: 'txn-3',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('100.00'),
        currency: Currency.USD,
        date: new Date('2024-03-25'),
        month: new Date('2024-03-01'),
        description: null,
        isRecurring: false,
        isMutual: false,
        recurringTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transaction.create).mockResolvedValue(mockTransaction as never)

      await createTransaction(input)

      expect(getMonthStart).toHaveBeenCalledWith(new Date('2024-03-25'))
      const call = vi.mocked(prisma.transaction.create).mock.calls[0][0]
      expect(call.data.month).toEqual(new Date(Date.UTC(2024, 2, 1)))
    })

    it('should create recurring transaction with templateId', async () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        isRecurring: true,
        recurringTemplateId: 'tmpl-1',
      }

      const mockTransaction = {
        id: 'txn-4',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('100.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        month: new Date('2024-01-01'),
        description: null,
        isRecurring: true,
        isMutual: false,
        recurringTemplateId: 'tmpl-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transaction.create).mockResolvedValue(mockTransaction as never)

      await createTransaction(input)

      const call = vi.mocked(prisma.transaction.create).mock.calls[0][0]
      expect(call.data.isRecurring).toBe(true)
      expect(call.data.recurringTemplateId).toBe('tmpl-1')
    })

    it('should default isRecurring to false when omitted', async () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: new Date('2024-01-15'),
      }

      const mockTransaction = {
        id: 'txn-5',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('100.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        month: new Date('2024-01-01'),
        description: null,
        isRecurring: false,
        isMutual: false,
        recurringTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transaction.create).mockResolvedValue(mockTransaction as never)

      await createTransaction(input)

      const call = vi.mocked(prisma.transaction.create).mock.calls[0][0]
      expect(call.data.isRecurring).toBe(false)
    })

    it('should support INCOME type', async () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.INCOME,
        amount: 2000,
        currency: Currency.USD,
        date: new Date('2024-01-15'),
      }

      const mockTransaction = {
        id: 'txn-6',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.INCOME,
        amount: mockDecimal('2000.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        month: new Date('2024-01-01'),
        description: null,
        isRecurring: false,
        isMutual: false,
        recurringTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transaction.create).mockResolvedValue(mockTransaction as never)

      const result = await createTransaction(input)

      expect(result.type).toBe(TransactionType.INCOME)
    })

    it('should handle Prisma create failure', async () => {
      const input: CreateTransactionInput = {
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: new Date('2024-01-15'),
      }

      const error = new Error('Database error')
      vi.mocked(prisma.transaction.create).mockRejectedValue(error)

      await expect(createTransaction(input)).rejects.toThrow('Database error')
    })
  })

  describe('Phase 2: updateTransaction()', () => {
    it('should update transaction with all fields', async () => {
      const input: UpdateTransactionInput = {
        id: 'txn-1',
        accountId: 'acc-1',
        categoryId: 'cat-2',
        type: TransactionType.EXPENSE,
        amount: 75.5,
        currency: Currency.EUR,
        date: new Date('2024-01-20'),
        description: 'Updated description',
        isRecurring: false,
      }

      const mockTransaction = {
        id: 'txn-1',
        accountId: 'acc-1',
        categoryId: 'cat-2',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('75.50'),
        currency: Currency.EUR,
        date: new Date('2024-01-20'),
        month: new Date('2024-01-01'),
        description: 'Updated description',
        isRecurring: false,
        isMutual: false,
        recurringTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transaction.update).mockResolvedValue(mockTransaction as never)

      await updateTransaction(input)

      expect(getMonthStart).toHaveBeenCalledWith(new Date('2024-01-20'))
    })

    it('should recalculate month when date changes', async () => {
      const input: UpdateTransactionInput = {
        id: 'txn-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: new Date('2024-02-15'),
      }

      const mockTransaction = {
        id: 'txn-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('100.00'),
        currency: Currency.USD,
        date: new Date('2024-02-15'),
        month: new Date('2024-02-01'),
        description: null,
        isRecurring: false,
        isMutual: false,
        recurringTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transaction.update).mockResolvedValue(mockTransaction as never)

      await updateTransaction(input)

      expect(getMonthStart).toHaveBeenCalledWith(new Date('2024-02-15'))
      const call = vi.mocked(prisma.transaction.update).mock.calls[0][0]
      expect(call.data.month).toEqual(new Date(Date.UTC(2024, 1, 1)))
    })

    it('should handle transaction not found', async () => {
      const input: UpdateTransactionInput = {
        id: 'nonexistent',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: 100,
        currency: Currency.USD,
        date: new Date('2024-01-15'),
      }

      const error = new Error('Record not found')
      ;(error as PrismaError).code = 'P2025'

      vi.mocked(prisma.transaction.update).mockRejectedValue(error)

      await expect(updateTransaction(input)).rejects.toThrow('Record not found')
    })
  })

  describe('Phase 3: deleteTransaction()', () => {
    it('should delete transaction by ID', async () => {
      const mockTransaction = {
        id: 'txn-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('100.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        month: new Date('2024-01-01'),
        description: null,
        isRecurring: false,
        isMutual: false,
        recurringTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transaction.delete).mockResolvedValue(mockTransaction as never)

      const result = await deleteTransaction('txn-1')

      expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: 'txn-1' } })
      expect(result).toEqual(mockTransaction)
    })

    it('should handle transaction not found', async () => {
      const error = new Error('Record not found')
      ;(error as PrismaError).code = 'P2025'

      vi.mocked(prisma.transaction.delete).mockRejectedValue(error)

      await expect(deleteTransaction('nonexistent')).rejects.toThrow('Record not found')
    })
  })

  describe('Phase 4: getTransactionById()', () => {
    it('should find existing transaction', async () => {
      const mockTransaction = {
        id: 'txn-1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: TransactionType.EXPENSE,
        amount: mockDecimal('100.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        month: new Date('2024-01-01'),
        description: 'Test',
        isRecurring: false,
        isMutual: false,
        recurringTemplateId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(mockTransaction as never)

      const result = await getTransactionById('txn-1')

      expect(prisma.transaction.findUnique).toHaveBeenCalledWith({ where: { id: 'txn-1' } })
      expect(result).toEqual(mockTransaction)
    })

    it('should return null when not found', async () => {
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null)

      const result = await getTransactionById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('Phase 5: createTransactionRequest()', () => {
    it('should create request with all fields', async () => {
      const input: CreateTransactionRequestInput = {
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: 50,
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Request payment',
      }

      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Request payment',
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.create).mockResolvedValue(mockRequest as never)

      await createTransactionRequest(input)

      const call = vi.mocked(prisma.transactionRequest.create).mock.calls[0][0]
      expect(call.data.status).toBe(RequestStatus.PENDING)
    })

    it('should create request without description', async () => {
      const input: CreateTransactionRequestInput = {
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: 50,
        currency: Currency.USD,
        date: new Date('2024-01-15'),
      }

      const mockRequest = {
        id: 'req-2',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: null,
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.create).mockResolvedValue(mockRequest as never)

      await createTransactionRequest(input)

      const call = vi.mocked(prisma.transactionRequest.create).mock.calls[0][0]
      expect(call.data.description).toBeUndefined()
    })

    it('should always set status to PENDING', async () => {
      const input: CreateTransactionRequestInput = {
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: 50,
        currency: Currency.USD,
        date: new Date('2024-01-15'),
      }

      const mockRequest = {
        id: 'req-3',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: null,
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.create).mockResolvedValue(mockRequest as never)

      const result = await createTransactionRequest(input)

      expect(result.status).toBe(RequestStatus.PENDING)
    })
  })

  describe('Phase 6: getTransactionRequestById()', () => {
    it('should find existing request', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Test',
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as never)

      const result = await getTransactionRequestById('req-1')

      expect(prisma.transactionRequest.findUnique).toHaveBeenCalledWith({ where: { id: 'req-1' } })
      expect(result).toEqual(mockRequest)
    })

    it('should return null when not found', async () => {
      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(null)

      const result = await getTransactionRequestById('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('Phase 7: approveTransactionRequest() - State Machine', () => {
    it('should approve PENDING request and create transaction', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Payment request',
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as never)
      vi.mocked(prisma.$transaction).mockResolvedValue([mockRequest, {}] as never)

      await approveTransactionRequest('req-1')

      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      const txnArray = vi.mocked(prisma.$transaction).mock.calls[0]?.[0] as unknown as unknown[]
      expect(txnArray).toHaveLength(2)
    })

    it('should use request.toId as transaction accountId', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Payment request',
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as never)

      // Capture the transaction array
      let capturedTxn: unknown[] = []
      vi.mocked(prisma.$transaction).mockImplementation(async (txn) => {
        capturedTxn = txn as unknown as unknown[]
        return [mockRequest, {}] as never
      })

      await approveTransactionRequest('req-1')

      // The second item in the array should be the transaction.create call
      expect(capturedTxn).toHaveLength(2)
    })

    it('should set transaction type to EXPENSE', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Payment request',
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as never)
      vi.mocked(prisma.$transaction).mockResolvedValue([mockRequest, {}] as never)

      await approveTransactionRequest('req-1')

      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('should calculate month from request date', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Payment request',
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as never)
      vi.mocked(prisma.$transaction).mockResolvedValue([mockRequest, {}] as never)

      await approveTransactionRequest('req-1')

      expect(getMonthStart).toHaveBeenCalledWith(new Date('2024-01-15'))
    })

    it('should throw error if request not found', async () => {
      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(null)

      await expect(approveTransactionRequest('nonexistent')).rejects.toThrow('Transaction request not found')
    })

    it('should throw error if request already approved', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Payment request',
        status: RequestStatus.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as never)

      await expect(approveTransactionRequest('req-1')).rejects.toThrow('Request is already approved')
    })

    it('should throw error if request already rejected', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Payment request',
        status: RequestStatus.REJECTED,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as never)

      await expect(approveTransactionRequest('req-1')).rejects.toThrow('Request is already rejected')
    })
  })

  describe('Phase 8: rejectTransactionRequest() - State Machine', () => {
    it('should reject PENDING request', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Payment request',
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const rejectedRequest = { ...mockRequest, status: RequestStatus.REJECTED }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as never)
      vi.mocked(prisma.transactionRequest.update).mockResolvedValue(rejectedRequest as never)

      const result = await rejectTransactionRequest('req-1')

      expect(prisma.transactionRequest.update).toHaveBeenCalledWith({
        where: { id: 'req-1' },
        data: { status: RequestStatus.REJECTED },
      })
      expect(result.status).toBe(RequestStatus.REJECTED)
    })

    it('should not create transaction on rejection', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Payment request',
        status: RequestStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      const rejectedRequest = { ...mockRequest, status: RequestStatus.REJECTED }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as never)
      vi.mocked(prisma.transactionRequest.update).mockResolvedValue(rejectedRequest as never)

      await rejectTransactionRequest('req-1')

      expect(prisma.transaction.create).not.toHaveBeenCalled()
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('should throw error if request not found', async () => {
      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(null)

      await expect(rejectTransactionRequest('nonexistent')).rejects.toThrow('Transaction request not found')
    })

    it('should throw error if request already approved', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Payment request',
        status: RequestStatus.APPROVED,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as never)

      await expect(rejectTransactionRequest('req-1')).rejects.toThrow('Request is already approved')
    })

    it('should throw error if request already rejected', async () => {
      const mockRequest = {
        id: 'req-1',
        fromId: 'acc-1',
        toId: 'acc-2',
        categoryId: 'cat-1',
        amount: mockDecimal('50.00'),
        currency: Currency.USD,
        date: new Date('2024-01-15'),
        description: 'Payment request',
        status: RequestStatus.REJECTED,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.transactionRequest.findUnique).mockResolvedValue(mockRequest as never)

      await expect(rejectTransactionRequest('req-1')).rejects.toThrow('Request is already rejected')
    })
  })

  describe('Phase 9: getUserPrimaryAccount()', () => {
    it('should find SELF account from names', async () => {
      const mockAccount = {
        id: 'acc-1',
        name: 'Account1',
        type: 'SELF',
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockAccount as never)

      const result = await getUserPrimaryAccount(['Account1', 'Shared'])

      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { name: { in: ['Account1', 'Shared'] }, type: 'SELF' },
      })
      expect(result).toEqual(mockAccount)
    })

    it('should return null when no account found', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null)

      const result = await getUserPrimaryAccount(['Nonexistent'])

      expect(result).toBeNull()
    })

    it('should filter by type SELF', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null)

      await getUserPrimaryAccount(['Account1'])

      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({ type: 'SELF' }),
      })
    })
  })
})
