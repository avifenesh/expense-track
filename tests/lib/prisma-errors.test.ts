import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handlePrismaError } from '@/lib/prisma-errors'

// Mock server-logger to prevent console output during tests
vi.mock('@/lib/server-logger', () => ({
  serverLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

describe('handlePrismaError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('unique constraint errors (P2002)', () => {
    it('returns field-specific error for single field unique constraint', () => {
      const error = {
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
        meta: { target: ['email'] },
        message: 'Unique constraint failed',
      }

      const result = handlePrismaError(error, {
        action: 'createUser',
        uniqueMessage: 'Email already exists',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.email).toEqual(['Email already exists'])
      }
    })

    it('returns field-specific errors for compound unique constraint', () => {
      const error = {
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
        meta: { target: ['userId', 'name', 'type'] },
        message: 'Unique constraint failed',
      }

      const result = handlePrismaError(error, {
        action: 'createCategory',
        uniqueMessage: 'Category already exists',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.userId).toEqual(['Category already exists'])
        expect(result.error.name).toEqual(['Category already exists'])
        expect(result.error.type).toEqual(['Category already exists'])
      }
    })

    it('handles string target from some Prisma versions', () => {
      const error = {
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
        meta: { target: 'email' as unknown as string[] },
        message: 'Unique constraint failed',
      }

      const result = handlePrismaError(error, {
        action: 'createUser',
        uniqueMessage: 'Already exists',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.email).toEqual(['Already exists'])
      }
    })

    it('returns general error when target is not available', () => {
      const error = {
        name: 'PrismaClientKnownRequestError',
        code: 'P2002',
        meta: {},
        message: 'Unique constraint failed',
      }

      const result = handlePrismaError(error, {
        action: 'createUser',
        uniqueMessage: 'Already exists',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('Already exists')
      }
    })
  })

  describe('not found errors (P2025)', () => {
    it('returns not found error with custom message', () => {
      const error = {
        name: 'PrismaClientKnownRequestError',
        code: 'P2025',
        meta: {},
        message: 'Record not found',
      }

      const result = handlePrismaError(error, {
        action: 'deleteUser',
        notFoundMessage: 'User not found',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('User not found')
      }
    })

    it('uses default not found message when not provided', () => {
      const error = {
        name: 'PrismaClientKnownRequestError',
        code: 'P2025',
        meta: {},
        message: 'Record not found',
      }

      const result = handlePrismaError(error, {
        action: 'deleteUser',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('Record not found')
      }
    })
  })

  describe('foreign key constraint errors (P2003)', () => {
    it('returns foreign key error with custom message', () => {
      const error = {
        name: 'PrismaClientKnownRequestError',
        code: 'P2003',
        meta: {},
        message: 'Foreign key constraint failed',
      }

      const result = handlePrismaError(error, {
        action: 'createTransaction',
        foreignKeyMessage: 'Category does not exist',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('Category does not exist')
      }
    })
  })

  describe('required relation violation errors (P2014)', () => {
    it('returns appropriate error for relation violations', () => {
      const error = {
        name: 'PrismaClientKnownRequestError',
        code: 'P2014',
        meta: {},
        message: 'Required relation violation',
      }

      const result = handlePrismaError(error, {
        action: 'deleteCategory',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general.some((msg: string) => msg.includes('existing related data'))).toBe(true)
      }
    })
  })

  describe('invalid data errors (P2000)', () => {
    it('returns invalid data error', () => {
      const error = {
        name: 'PrismaClientKnownRequestError',
        code: 'P2000',
        meta: {},
        message: 'Invalid data',
      }

      const result = handlePrismaError(error, {
        action: 'createUser',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('Invalid data provided')
      }
    })
  })

  describe('validation errors', () => {
    it('handles PrismaClientValidationError', () => {
      const error = {
        name: 'PrismaClientValidationError',
        message: 'Validation failed',
      }

      const result = handlePrismaError(error, {
        action: 'createUser',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('Invalid data format')
      }
    })
  })

  describe('initialization errors', () => {
    it('handles PrismaClientInitializationError', () => {
      const error = {
        name: 'PrismaClientInitializationError',
        message: 'Connection failed',
      }

      const result = handlePrismaError(error, {
        action: 'createUser',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general.some((msg: string) => msg.includes('Service temporarily unavailable'))).toBe(true)
      }
    })
  })

  describe('panic errors', () => {
    it('handles PrismaClientRustPanicError', () => {
      const error = {
        name: 'PrismaClientRustPanicError',
        message: 'Panic occurred',
      }

      const result = handlePrismaError(error, {
        action: 'createUser',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general.some((msg: string) => msg.includes('Service error'))).toBe(true)
      }
    })
  })

  describe('generic errors', () => {
    it('handles standard Error objects', () => {
      const error = new Error('Something went wrong')

      const result = handlePrismaError(error, {
        action: 'createUser',
        fallbackMessage: 'Unable to create user',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('Unable to create user')
      }
    })

    it('handles unknown error types', () => {
      const error = 'string error'

      const result = handlePrismaError(error, {
        action: 'createUser',
        fallbackMessage: 'Operation failed',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('Operation failed')
      }
    })

    it('uses default fallback message when not provided', () => {
      const error = new Error('Something went wrong')

      const result = handlePrismaError(error, {
        action: 'createUser',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general.some((msg: string) => msg.includes('An unexpected error occurred'))).toBe(true)
      }
    })
  })
})
