import { describe, expect, it, vi, beforeEach } from 'vitest'
import bcrypt from 'bcryptjs'
import { Currency } from '@prisma/client'

// Test password used for mock users
const TEST_PASSWORD = 'TestPassword123!'

// Mock prisma to avoid DATABASE_URL requirement
vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
    },
    transactionRequest: {
      deleteMany: vi.fn(),
    },
    transaction: {
      deleteMany: vi.fn(),
    },
    holding: {
      deleteMany: vi.fn(),
    },
    budget: {
      deleteMany: vi.fn(),
    },
    recurringTemplate: {
      deleteMany: vi.fn(),
    },
    dashboardCache: {
      deleteMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock auth module - no longer exports AUTH_USERS or RECOVERY_CONTACTS
vi.mock('@/lib/auth', () => ({
  SESSION_COOKIE: 'balance_session',
  USER_COOKIE: 'balance_user',
  ACCOUNT_COOKIE: 'balance_account',
  SESSION_TS_COOKIE: 'balance_session_ts',
  SESSION_MAX_AGE_MS: 30 * 24 * 60 * 60 * 1000,
}))

// Mock auth-server to use database-based verification
vi.mock('@/lib/auth-server', () => ({
  verifyCredentials: vi.fn(),
  getDbUserAsAuthUser: vi.fn(),
  requireSession: vi.fn(),
  establishSession: vi.fn().mockResolvedValue(undefined),
  clearSession: vi.fn().mockResolvedValue(undefined),
  updateSessionAccount: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn().mockResolvedValue(true),
  rotateCsrfToken: vi.fn().mockResolvedValue('new-token'),
  requireCsrfToken: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimitTyped: vi.fn().mockReturnValue({ allowed: true, limit: 3, remaining: 3, resetAt: new Date() }),
  incrementRateLimitTyped: vi.fn(),
  resetRateLimitTyped: vi.fn(),
  resetAllRateLimits: vi.fn(),
}))

vi.mock('@/app/actions/shared', () => ({
  parseInput: vi.fn((schema, input) => {
    const parsed = schema.safeParse(input)
    if (!parsed.success) {
      return { error: parsed.error.flatten().fieldErrors as Record<string, string[]> }
    }
    return { data: parsed.data }
  }),
  ensureAccountAccess: vi.fn().mockResolvedValue({
    account: { id: 'acc-1', name: 'Test1', type: 'SELF' },
  }),
  requireCsrfToken: vi.fn().mockResolvedValue({ success: true }),
  requireAuthUser: vi.fn(),
}))

import { verifyCredentials, establishSession, clearSession, updateSessionAccount } from '@/lib/auth-server'
import { rotateCsrfToken } from '@/lib/csrf'
import { ensureAccountAccess, requireCsrfToken, requireAuthUser } from '@/app/actions/shared'
import {
  loginAction,
  logoutAction,
  requestPasswordResetAction,
  persistActiveAccountAction,
  deleteAccountAction,
} from '@/app/actions'
import { prisma } from '@/lib/prisma'
import type { Account } from '@prisma/client'

// Test users setup
const testPasswordHash = bcrypt.hashSync(TEST_PASSWORD, 10)

const TEST_USER_1 = {
  id: 'user-1',
  email: 'test1@example.com',
  displayName: 'Test User 1',
  passwordHash: testPasswordHash,
  accountNames: ['Test1'],
  defaultAccountName: 'Test1',
  preferredCurrency: Currency.USD,
  hasCompletedOnboarding: true,
}

const TEST_USER_2 = {
  id: 'user-2',
  email: 'test2@example.com',
  displayName: 'Test User 2',
  passwordHash: testPasswordHash,
  accountNames: ['Test2', 'Test3'],
  defaultAccountName: 'Test2',
  preferredCurrency: Currency.USD,
  hasCompletedOnboarding: true,
}

// Helper to create mock Account objects with all required properties
function mockAccount(partial: Partial<Account>): Account {
  return {
    id: partial.id ?? 'test-id',
    userId: partial.userId ?? 'test-user',
    name: partial.name ?? 'TestAccount',
    type: partial.type ?? 'SELF',
    preferredCurrency: partial.preferredCurrency ?? null,
    color: partial.color ?? null,
    icon: partial.icon ?? null,
    description: partial.description ?? null,
    createdAt: partial.createdAt ?? new Date(),
    updatedAt: partial.updatedAt ?? new Date(),
  }
}

describe('auth actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('auth credential verification', () => {
    it('accepts valid credentials', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: true, userId: TEST_USER_1.id })

      const result = await verifyCredentials({ email: TEST_USER_1.email, password: TEST_PASSWORD })
      expect(result.valid).toBe(true)
      if (result.valid) {
        expect(result.userId).toBe(TEST_USER_1.id)
      }
    })

    it('rejects a wrong password', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: false })

      const result = await verifyCredentials({ email: TEST_USER_1.email, password: 'wrong-pass' })
      expect(result.valid).toBe(false)
    })

    it('rejects an unexpected email', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: false })

      const result = await verifyCredentials({ email: 'unauthorized@example.com', password: TEST_PASSWORD })
      expect(result.valid).toBe(false)
    })
  })

  describe('loginAction', () => {
    it('succeeds with valid credentials and single account', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: true, userId: TEST_USER_1.id })
      // loginAction queries prisma.user.findUnique with include: { accounts }
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: TEST_USER_1.id,
        email: TEST_USER_1.email,
        displayName: TEST_USER_1.displayName,
        passwordHash: TEST_USER_1.passwordHash,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: [mockAccount({ id: 'acc-1', name: 'Test1', type: 'SELF' })],
      } as never)

      const result = await loginAction({ email: TEST_USER_1.email, password: TEST_PASSWORD })

      expect(result).toEqual({ success: true, data: { accountId: 'acc-1' } })
      expect(establishSession).toHaveBeenCalledWith({
        userEmail: TEST_USER_1.email,
        accountId: 'acc-1',
      })
      expect(rotateCsrfToken).toHaveBeenCalled()
    })

    it('succeeds with multiple accounts and chooses a default account', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: true, userId: TEST_USER_2.id })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: TEST_USER_2.id,
        email: TEST_USER_2.email,
        displayName: TEST_USER_2.displayName,
        passwordHash: TEST_USER_2.passwordHash,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: [
          mockAccount({ id: 'acc-2', name: 'Test2', type: 'SELF' }),
          mockAccount({ id: 'acc-3', name: 'Test3', type: 'SELF' }),
        ],
      } as never)

      const result = await loginAction({ email: TEST_USER_2.email, password: TEST_PASSWORD })

      expect(result).toEqual({ success: true, data: { accountId: 'acc-2' } })
      expect(establishSession).toHaveBeenCalledWith({
        userEmail: TEST_USER_2.email,
        accountId: 'acc-2',
      })
    })

    it('selects first account from sorted list', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: true, userId: TEST_USER_2.id })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: TEST_USER_2.id,
        email: TEST_USER_2.email,
        displayName: TEST_USER_2.displayName,
        passwordHash: TEST_USER_2.passwordHash,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: [
          mockAccount({ id: 'acc-3', name: 'Test3', type: 'SELF' }),
          mockAccount({ id: 'acc-4', name: 'Test4', type: 'SELF' }),
        ],
      } as never)

      const result = await loginAction({ email: TEST_USER_2.email, password: TEST_PASSWORD })

      expect(result).toEqual({ success: true, data: { accountId: 'acc-3' } })
      expect(establishSession).toHaveBeenCalledWith({
        userEmail: TEST_USER_2.email,
        accountId: 'acc-3',
      })
    })

    it('rejects invalid email format', async () => {
      const result = await loginAction({ email: 'not-an-email', password: TEST_PASSWORD })

      expect('error' in result).toBe(true)
      expect(establishSession).not.toHaveBeenCalled()
    })

    it('rejects missing password', async () => {
      const result = await loginAction({ email: 'test@example.com', password: '' })

      expect('error' in result).toBe(true)
      expect(establishSession).not.toHaveBeenCalled()
    })

    it('handles email case-insensitively', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: true, userId: TEST_USER_1.id })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: TEST_USER_1.id,
        email: TEST_USER_1.email,
        displayName: TEST_USER_1.displayName,
        passwordHash: TEST_USER_1.passwordHash,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: [mockAccount({ id: 'acc-1', name: 'Test1', type: 'SELF' })],
      } as never)

      const result = await loginAction({ email: TEST_USER_1.email.toUpperCase(), password: TEST_PASSWORD })

      expect(result).toEqual({ success: true, data: { accountId: 'acc-1' } })
    })

    it('trims email whitespace', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: true, userId: TEST_USER_1.id })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: TEST_USER_1.id,
        email: TEST_USER_1.email,
        displayName: TEST_USER_1.displayName,
        passwordHash: TEST_USER_1.passwordHash,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: [mockAccount({ id: 'acc-1', name: 'Test1', type: 'SELF' })],
      } as never)

      const result = await loginAction({ email: `  ${TEST_USER_1.email}  `, password: TEST_PASSWORD })

      expect(result).toEqual({ success: true, data: { accountId: 'acc-1' } })
    })

    it('rejects invalid credentials', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: false })

      const result = await loginAction({ email: TEST_USER_1.email, password: 'WrongPassword' })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.credentials).toContain('Invalid username or password')
      }
      expect(establishSession).not.toHaveBeenCalled()
    })

    it('rejects unknown email', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: false })

      const result = await loginAction({ email: 'unknown@example.com', password: TEST_PASSWORD })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.credentials).toContain('Invalid username or password')
      }
      expect(establishSession).not.toHaveBeenCalled()
    })

    it('returns error when no accounts provisioned', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: true, userId: TEST_USER_1.id })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: TEST_USER_1.id,
        email: TEST_USER_1.email,
        displayName: TEST_USER_1.displayName,
        passwordHash: TEST_USER_1.passwordHash,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: [],
      } as never)

      const result = await loginAction({ email: TEST_USER_1.email, password: TEST_PASSWORD })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('No accounts found. Please contact support.')
      }
      expect(establishSession).not.toHaveBeenCalled()
    })

    it('queries user with accounts', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: true, userId: TEST_USER_1.id })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: TEST_USER_1.id,
        email: TEST_USER_1.email,
        displayName: TEST_USER_1.displayName,
        passwordHash: TEST_USER_1.passwordHash,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: [mockAccount({ id: 'acc-1', name: 'Test1', type: 'SELF' })],
      } as never)

      await loginAction({ email: TEST_USER_1.email, password: TEST_PASSWORD })

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: TEST_USER_1.email },
        include: { accounts: { orderBy: { name: 'asc' } } },
      })
    })

    it('returns accounts sorted by name', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: true, userId: TEST_USER_2.id })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: TEST_USER_2.id,
        email: TEST_USER_2.email,
        displayName: TEST_USER_2.displayName,
        passwordHash: TEST_USER_2.passwordHash,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: [
          mockAccount({ id: 'acc-2', name: 'Test2', type: 'SELF' }),
          mockAccount({ id: 'acc-3', name: 'Test3', type: 'SELF' }),
        ],
      } as never)

      const result = await loginAction({ email: TEST_USER_2.email, password: TEST_PASSWORD })

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: TEST_USER_2.email },
        include: { accounts: { orderBy: { name: 'asc' } } },
      })
      expect(result).toEqual({ success: true, data: { accountId: 'acc-2' } })
    })

    it('calls rotateCsrfToken after successful login', async () => {
      vi.mocked(verifyCredentials).mockResolvedValue({ valid: true, userId: TEST_USER_1.id })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: TEST_USER_1.id,
        email: TEST_USER_1.email,
        displayName: TEST_USER_1.displayName,
        passwordHash: TEST_USER_1.passwordHash,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        accounts: [mockAccount({ id: 'acc-1', name: 'Test1', type: 'SELF' })],
      } as never)

      await loginAction({ email: TEST_USER_1.email, password: TEST_PASSWORD })

      expect(rotateCsrfToken).toHaveBeenCalledTimes(1)
    })
  })

  describe('logoutAction', () => {
    it('calls clearSession successfully', async () => {
      const result = await logoutAction()

      expect(clearSession).toHaveBeenCalledTimes(1)
      expect(result).toEqual({ success: true })
    })

    it('returns successVoid with data undefined', async () => {
      const result = await logoutAction()

      expect(result).toEqual({ success: true, data: undefined })
      if ('success' in result && result.success) {
        expect(result.data).toBeUndefined()
      }
    })

    it('works even without active session', async () => {
      vi.mocked(clearSession).mockResolvedValue(undefined)

      const result = await logoutAction()

      expect(result).toEqual({ success: true })
      expect(clearSession).toHaveBeenCalled()
    })
  })

  describe('requestPasswordResetAction', () => {
    it('returns honest message that feature is not yet implemented', async () => {
      const response = await requestPasswordResetAction({ email: 'test1@example.com' })

      expect('success' in response && response.success).toBe(true)
      if ('success' in response && response.success) {
        expect(response.data.message).toContain('Password reset via email is not yet available')
      }
    })

    it('returns same message for any email (feature not implemented)', async () => {
      const response = await requestPasswordResetAction({ email: 'unknown@example.com' })

      // Should return success with honest message about feature status
      expect('success' in response && response.success).toBe(true)
      if ('success' in response && response.success) {
        expect(response.data.message).toContain('Password reset via email is not yet available')
      }
    })

    it('rejects invalid email format', async () => {
      const response = await requestPasswordResetAction({ email: 'not-an-email' })

      expect('error' in response).toBe(true)
    })

    it('handles email case-insensitively', async () => {
      const response = await requestPasswordResetAction({ email: 'TEST1@EXAMPLE.COM' })

      // Should succeed regardless of email case
      expect('success' in response && response.success).toBe(true)
    })

    it('rejects email with whitespace (not trimmed before validation)', async () => {
      const response = await requestPasswordResetAction({ email: '  test1@example.com  ' })

      // Email with whitespace fails Zod email validation
      expect('error' in response).toBe(true)
      if ('error' in response) {
        expect(response.error.email).toBeDefined()
      }
    })

    it('returns generic success for unknown email (security best practice)', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const response = await requestPasswordResetAction({ email: 'unknown@example.com' })

      // Returns success (not error) to prevent email enumeration attacks
      expect('success' in response && response.success).toBe(true)
      if ('success' in response && response.success) {
        expect(response.data.message).toBeDefined()
      }
    })
  })

  describe('persistActiveAccountAction', () => {
    it('successfully updates account with valid inputs', async () => {
      const result = await persistActiveAccountAction({
        accountId: 'acc-1',
        csrfToken: 'valid-token',
      })

      expect(result).toEqual({ success: true })
      expect(updateSessionAccount).toHaveBeenCalledWith('acc-1')
    })

    it('rejects missing accountId', async () => {
      const result = await persistActiveAccountAction({
        accountId: '',
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
      expect(updateSessionAccount).not.toHaveBeenCalled()
    })

    it('rejects invalid CSRF token', async () => {
      vi.mocked(requireCsrfToken).mockResolvedValueOnce({
        error: { csrf: ['Invalid CSRF token'] },
      } as const)

      const result = await persistActiveAccountAction({
        accountId: 'acc-1',
        csrfToken: 'invalid-token',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect('csrf' in result.error && result.error.csrf).toBeDefined()
      }
      expect(ensureAccountAccess).not.toHaveBeenCalled()
    })

    it('rejects missing CSRF token', async () => {
      const result = await persistActiveAccountAction({
        accountId: 'acc-1',
        csrfToken: '',
      })

      expect('error' in result).toBe(true)
      expect(updateSessionAccount).not.toHaveBeenCalled()
    })

    it('validates CSRF token before account access', async () => {
      await persistActiveAccountAction({
        accountId: 'acc-1',
        csrfToken: 'valid-token',
      })

      expect(requireCsrfToken).toHaveBeenCalledWith('valid-token')
      expect(requireCsrfToken).toHaveBeenCalledBefore(vi.mocked(ensureAccountAccess))
    })

    it('rejects when ensureAccountAccess fails (no session)', async () => {
      vi.mocked(ensureAccountAccess).mockResolvedValueOnce({
        error: { general: ['Your session expired. Please log in again.'] },
      } as const)

      const result = await persistActiveAccountAction({
        accountId: 'acc-1',
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toBeDefined()
      }
      expect(updateSessionAccount).not.toHaveBeenCalled()
    })

    it('rejects when ensureAccountAccess fails (account not found)', async () => {
      vi.mocked(ensureAccountAccess).mockResolvedValueOnce({
        error: { accountId: ['Account not found'] },
      } as const)

      const result = await persistActiveAccountAction({
        accountId: 'invalid-id',
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
      expect(updateSessionAccount).not.toHaveBeenCalled()
    })

    it('rejects when user lacks account access', async () => {
      vi.mocked(ensureAccountAccess).mockResolvedValueOnce({
        error: { accountId: ['You do not have access to this account'] },
      } as const)

      const result = await persistActiveAccountAction({
        accountId: 'acc-unauthorized',
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect('accountId' in result.error && result.error.accountId).toBeDefined()
      }
      expect(updateSessionAccount).not.toHaveBeenCalled()
    })

    it('handles updateSessionAccount failure', async () => {
      vi.mocked(updateSessionAccount).mockResolvedValueOnce({
        error: { general: ['Failed to update session'] },
      } as const)

      const result = await persistActiveAccountAction({
        accountId: 'acc-1',
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toBeDefined()
      }
    })

    it('returns successVoid on successful update', async () => {
      const result = await persistActiveAccountAction({
        accountId: 'acc-1',
        csrfToken: 'valid-token',
      })

      expect(result).toEqual({ success: true, data: undefined })
      if ('success' in result && result.success) {
        expect(result.data).toBeUndefined()
      }
    })
  })

  describe('deleteAccountAction', () => {
    beforeEach(() => {
      vi.mocked(requireAuthUser).mockResolvedValue({
        authUser: { ...TEST_USER_1 },
      })
      vi.mocked(requireCsrfToken).mockResolvedValue({ success: true })
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        mockAccount({ id: 'acc-1', userId: TEST_USER_1.id, name: 'Test1' }),
      ])
      vi.mocked(prisma.category.findMany).mockResolvedValue([{ id: 'cat-1', userId: TEST_USER_1.id } as never])
      vi.mocked(prisma.$transaction).mockResolvedValue(undefined)
    })

    it('successfully deletes account with matching email confirmation', async () => {
      const result = await deleteAccountAction({
        confirmEmail: TEST_USER_1.email,
        csrfToken: 'valid-token',
      })

      expect(result).toEqual({ success: true, data: undefined })
      expect(prisma.$transaction).toHaveBeenCalled()
      expect(clearSession).toHaveBeenCalled()
    })

    it('deletes all user data in correct order', async () => {
      await deleteAccountAction({
        confirmEmail: TEST_USER_1.email,
        csrfToken: 'valid-token',
      })

      // Verify $transaction was called with the deletion operations
      expect(prisma.$transaction).toHaveBeenCalledTimes(1)
      const transactionArg = vi.mocked(prisma.$transaction).mock.calls[0][0]
      expect(Array.isArray(transactionArg)).toBe(true)
      // Should have 7 delete operations: transactionRequest, transaction, holding, budget, recurringTemplate, dashboardCache, user
      expect(transactionArg).toHaveLength(7)
    })

    it('requires valid CSRF token', async () => {
      vi.mocked(requireCsrfToken).mockResolvedValueOnce({
        error: { general: ['Security validation failed. Please refresh the page and try again.'] },
      })

      const result = await deleteAccountAction({
        confirmEmail: TEST_USER_1.email,
        csrfToken: 'invalid-token',
      })

      expect('error' in result).toBe(true)
      expect(prisma.$transaction).not.toHaveBeenCalled()
      expect(clearSession).not.toHaveBeenCalled()
    })

    it('requires authenticated user', async () => {
      vi.mocked(requireAuthUser).mockResolvedValueOnce({
        error: { general: ['Your session expired. Please sign in again.'] },
      })

      const result = await deleteAccountAction({
        confirmEmail: TEST_USER_1.email,
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('Your session expired. Please sign in again.')
      }
      expect(prisma.$transaction).not.toHaveBeenCalled()
    })

    it('rejects when email confirmation does not match', async () => {
      const result = await deleteAccountAction({
        confirmEmail: 'wrong@example.com',
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.confirmEmail).toContain('Email does not match your account')
      }
      expect(prisma.$transaction).not.toHaveBeenCalled()
      expect(clearSession).not.toHaveBeenCalled()
    })

    it('handles email confirmation case-insensitively', async () => {
      const result = await deleteAccountAction({
        confirmEmail: TEST_USER_1.email.toUpperCase(),
        csrfToken: 'valid-token',
      })

      expect(result).toEqual({ success: true, data: undefined })
      expect(prisma.$transaction).toHaveBeenCalled()
    })

    it('clears session after successful deletion', async () => {
      await deleteAccountAction({
        confirmEmail: TEST_USER_1.email,
        csrfToken: 'valid-token',
      })

      expect(clearSession).toHaveBeenCalledTimes(1)
    })

    it('returns error when database transaction fails', async () => {
      vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('Database error'))

      const result = await deleteAccountAction({
        confirmEmail: TEST_USER_1.email,
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('Unable to delete account. Please try again or contact support.')
      }
      // Session should NOT be cleared if deletion fails
      expect(clearSession).not.toHaveBeenCalled()
    })

    it('rejects invalid email format', async () => {
      const result = await deleteAccountAction({
        confirmEmail: 'not-an-email',
        csrfToken: 'valid-token',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.confirmEmail).toBeDefined()
      }
    })

    it('rejects missing CSRF token', async () => {
      const result = await deleteAccountAction({
        confirmEmail: TEST_USER_1.email,
        csrfToken: '',
      })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.csrfToken).toBeDefined()
      }
    })

    it('fetches user accounts for deletion', async () => {
      await deleteAccountAction({
        confirmEmail: TEST_USER_1.email,
        csrfToken: 'valid-token',
      })

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_1.id },
        select: { id: true },
      })
    })

    it('fetches user categories for cross-account FK cleanup', async () => {
      await deleteAccountAction({
        confirmEmail: TEST_USER_1.email,
        csrfToken: 'valid-token',
      })

      expect(prisma.category.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_1.id },
        select: { id: true },
      })
    })

    it('handles user with multiple accounts', async () => {
      vi.mocked(requireAuthUser).mockResolvedValue({
        authUser: { ...TEST_USER_2 },
      })
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        mockAccount({ id: 'acc-2', userId: TEST_USER_2.id, name: 'Test2' }),
        mockAccount({ id: 'acc-3', userId: TEST_USER_2.id, name: 'Test3' }),
      ])

      const result = await deleteAccountAction({
        confirmEmail: TEST_USER_2.email,
        csrfToken: 'valid-token',
      })

      expect(result).toEqual({ success: true, data: undefined })
      expect(prisma.$transaction).toHaveBeenCalled()
    })
  })
})
