import { describe, expect, it, vi, beforeEach } from 'vitest'

// Test password used for mock users
const TEST_PASSWORD = 'TestPassword123!'

// Mock prisma to avoid DATABASE_URL requirement
vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

// Mock auth module with test users (data inlined to avoid hoisting issues)
vi.mock('@/lib/auth', async () => {
  const { Currency } = await import('@prisma/client')
  const bcryptLib = await import('bcryptjs')
  const hash = bcryptLib.default.hashSync('TestPassword123!', 10)

  const users = [
    {
      id: 'avi' as const,
      email: 'test1@example.com',
      displayName: 'Test User 1',
      passwordHash: hash,
      accountNames: ['Test1'],
      defaultAccountName: 'Test1',
      preferredCurrency: Currency.USD,
    },
    {
      id: 'serena' as const,
      email: 'test2@example.com',
      displayName: 'Test User 2',
      passwordHash: hash,
      accountNames: ['Test2', 'Test3'],
      defaultAccountName: 'Test2',
      preferredCurrency: Currency.USD,
    },
  ]

  const contacts = users.map((user) => ({
    email: user.email,
    label: `${user.displayName} recovery inbox`,
  }))

  return {
    AUTH_USERS: users,
    RECOVERY_CONTACTS: contacts,
    getAuthUsers: () => users,
    getRecoveryContacts: () => contacts,
    SESSION_COOKIE: 'balance_session',
    USER_COOKIE: 'balance_user',
    ACCOUNT_COOKIE: 'balance_account',
  }
})

// Mock auth-server to avoid SESSION_SECRET requirement
vi.mock('@/lib/auth-server', async () => {
  const bcryptLib = await import('bcryptjs')
  const authModule = await import('@/lib/auth')

  return {
    verifyCredentials: async ({ email, password }: { email: string; password: string }) => {
      const normalizedEmail = email.trim().toLowerCase()
      const authUser = authModule.AUTH_USERS.find((user) => user.email.toLowerCase() === normalizedEmail)
      if (!authUser) return false
      return bcryptLib.default.compare(password, authUser.passwordHash)
    },
    requireSession: vi.fn(),
    getAuthUserFromSession: vi.fn(),
    establishSession: vi.fn().mockResolvedValue(undefined),
    clearSession: vi.fn().mockResolvedValue(undefined),
    updateSessionAccount: vi.fn().mockResolvedValue({ success: true }),
  }
})

vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn().mockResolvedValue(true),
  rotateCsrfToken: vi.fn().mockResolvedValue('new-token'),
  requireCsrfToken: vi.fn().mockResolvedValue({ success: true }),
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
}))

import { AUTH_USERS, RECOVERY_CONTACTS } from '@/lib/auth'
import { verifyCredentials, establishSession, clearSession, updateSessionAccount } from '@/lib/auth-server'
import { rotateCsrfToken } from '@/lib/csrf'
import { ensureAccountAccess, requireCsrfToken } from '@/app/actions/shared'
import { loginAction, logoutAction, requestPasswordResetAction, persistActiveAccountAction } from '@/app/actions'
import { prisma } from '@/lib/prisma'
import type { Account } from '@prisma/client'

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
      const user = AUTH_USERS[0]
      const result = await verifyCredentials({ email: user.email, password: TEST_PASSWORD })
      expect(result).toBe(true)
    })

    it('rejects a wrong password', async () => {
      const user = AUTH_USERS[0]
      const result = await verifyCredentials({ email: user.email, password: 'wrong-pass' })
      expect(result).toBe(false)
    })

    it('rejects an unexpected email', async () => {
      const result = await verifyCredentials({ email: 'unauthorized@example.com', password: TEST_PASSWORD })
      expect(result).toBe(false)
    })
  })

  describe('loginAction', () => {
    it('succeeds with valid credentials and single account', async () => {
      const user = AUTH_USERS[0]
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockAccount({ id: 'acc-1', name: 'Test1', type: 'SELF' })])

      const result = await loginAction({ email: user.email, password: TEST_PASSWORD })

      expect(result).toEqual({ success: true, data: { accountId: 'acc-1' } })
      expect(establishSession).toHaveBeenCalledWith({
        userEmail: user.email,
        accountId: 'acc-1',
      })
      expect(rotateCsrfToken).toHaveBeenCalled()
    })

    it('succeeds with multiple accounts and selects default', async () => {
      const user = AUTH_USERS[1]
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        mockAccount({ id: 'acc-2', name: 'Test2', type: 'SELF' }),
        mockAccount({ id: 'acc-3', name: 'Test3', type: 'SELF' }),
      ])

      const result = await loginAction({ email: user.email, password: TEST_PASSWORD })

      expect(result).toEqual({ success: true, data: { accountId: 'acc-2' } })
      expect(establishSession).toHaveBeenCalledWith({
        userEmail: user.email,
        accountId: 'acc-2',
      })
    })

    it('fallback to first account when default not found', async () => {
      const user = AUTH_USERS[1]
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        mockAccount({ id: 'acc-3', name: 'Test3', type: 'SELF' }),
        mockAccount({ id: 'acc-4', name: 'Test4', type: 'SELF' }),
      ])

      const result = await loginAction({ email: user.email, password: TEST_PASSWORD })

      expect(result).toEqual({ success: true, data: { accountId: 'acc-3' } })
      expect(establishSession).toHaveBeenCalledWith({
        userEmail: user.email,
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
      const user = AUTH_USERS[0]
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockAccount({ id: 'acc-1', name: 'Test1', type: 'SELF' })])

      const result = await loginAction({ email: user.email.toUpperCase(), password: TEST_PASSWORD })

      expect(result).toEqual({ success: true, data: { accountId: 'acc-1' } })
    })

    it('trims email whitespace', async () => {
      const user = AUTH_USERS[0]
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockAccount({ id: 'acc-1', name: 'Test1', type: 'SELF' })])

      const result = await loginAction({ email: `  ${user.email}  `, password: TEST_PASSWORD })

      expect(result).toEqual({ success: true, data: { accountId: 'acc-1' } })
    })

    it('rejects invalid credentials', async () => {
      const user = AUTH_USERS[0]
      const result = await loginAction({ email: user.email, password: 'WrongPassword' })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.credentials).toContain('Invalid username or password')
      }
      expect(establishSession).not.toHaveBeenCalled()
    })

    it('rejects email not in AUTH_USERS after credential check', async () => {
      const result = await loginAction({ email: 'unknown@example.com', password: TEST_PASSWORD })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.credentials).toContain('Invalid username or password')
      }
      expect(establishSession).not.toHaveBeenCalled()
    })

    it('returns error when no accounts provisioned', async () => {
      const user = AUTH_USERS[0]
      vi.mocked(prisma.account.findMany).mockResolvedValue([])

      const result = await loginAction({ email: user.email, password: TEST_PASSWORD })

      expect('error' in result).toBe(true)
      if ('error' in result) {
        expect(result.error.general).toContain('No accounts are provisioned for this user. Please contact support.')
      }
      expect(establishSession).not.toHaveBeenCalled()
    })

    it('queries accounts with correct parameters', async () => {
      const user = AUTH_USERS[0]
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockAccount({ id: 'acc-1', name: 'Test1', type: 'SELF' })])

      await loginAction({ email: user.email, password: TEST_PASSWORD })

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { name: { in: ['Test1'] } },
        orderBy: { name: 'asc' },
      })
    })

    it('returns accounts sorted by name', async () => {
      const user = AUTH_USERS[1]
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        mockAccount({ id: 'acc-3', name: 'Test3', type: 'SELF' }),
        mockAccount({ id: 'acc-2', name: 'Test2', type: 'SELF' }),
      ])

      const result = await loginAction({ email: user.email, password: TEST_PASSWORD })

      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { name: { in: ['Test2', 'Test3'] } },
        orderBy: { name: 'asc' },
      })
      expect(result).toEqual({ success: true, data: { accountId: 'acc-2' } })
    })

    it('calls rotateCsrfToken after successful login', async () => {
      const user = AUTH_USERS[0]
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockAccount({ id: 'acc-1', name: 'Test1', type: 'SELF' })])

      await loginAction({ email: user.email, password: TEST_PASSWORD })

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
    it('returns a friendly confirmation for known inboxes', async () => {
      const target = RECOVERY_CONTACTS[0]
      const response = await requestPasswordResetAction({ email: target.email })
      expect(response).toEqual({
        success: true,
        message: expect.stringContaining(target.email),
      })
    })

    it('flags unknown inboxes', async () => {
      const response = await requestPasswordResetAction({ email: 'unknown@example.com' })
      expect(response).toEqual({
        error: {
          email: ['Email is not registered. Reach out to the finance team to restore access.'],
        },
      })
    })

    it('rejects invalid email format', async () => {
      const response = await requestPasswordResetAction({ email: 'not-an-email' })

      expect('error' in response).toBe(true)
    })

    it('handles email case-insensitively', async () => {
      const target = RECOVERY_CONTACTS[0]
      const response = await requestPasswordResetAction({ email: target.email.toUpperCase() })

      expect(response).toEqual({
        success: true,
        message: expect.stringContaining(target.email),
      })
    })

    it('rejects email with whitespace (not trimmed before validation)', async () => {
      const target = RECOVERY_CONTACTS[0]
      const response = await requestPasswordResetAction({ email: `  ${target.email}  ` })

      // Email with whitespace fails Zod email validation
      expect('error' in response).toBe(true)
      if ('error' in response) {
        expect(response.error.email).toBeDefined()
      }
    })

    it('includes complete success message format', async () => {
      const target = RECOVERY_CONTACTS[0]
      const response = await requestPasswordResetAction({ email: target.email })

      expect('success' in response && response.success).toBe(true)
      if ('success' in response && response.success) {
        expect(response.message).toContain('A reset link was sent to')
        expect(response.message).toContain(target.email)
        expect(response.message).toContain('Use the standard password after completing the guided reset')
      }
    })

    it('returns proper error structure for unknown email', async () => {
      const response = await requestPasswordResetAction({ email: 'unknown@example.com' })

      expect('error' in response).toBe(true)
      if ('error' in response) {
        expect(response.error.email).toBeDefined()
        expect(Array.isArray(response.error.email)).toBe(true)
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
})
