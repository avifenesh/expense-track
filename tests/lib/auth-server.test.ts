import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock dependencies BEFORE imports
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: {
      findUnique: vi.fn(),
    },
  },
}))

// Mock auth module with test users
// Pre-generated bcrypt hashes for testing (bcrypt.hashSync('password123', 10) and bcrypt.hashSync('securePass456', 10))
vi.mock('@/lib/auth', () => ({
  AUTH_USERS: [
    {
      id: 'user1',
      email: 'user1@test.com',
      displayName: 'User One',
      passwordHash: '$2b$10$42pR.56jnFNCaH9LXdV1y.7lHi2jmTU1LQOf5IxtnfPZOQHvce3d2', // password123
      accountNames: ['Account1', 'Shared'],
      defaultAccountName: 'Account1',
      preferredCurrency: 'USD',
    },
    {
      id: 'user2',
      email: 'user2@test.com',
      displayName: 'User Two',
      passwordHash: '$2b$10$fxmRGkj/pcH/j4fab6ucAeWUrWpRE7D6b3yYcCU1EteYd62dvRZ6u', // securePass456
      accountNames: ['Account2', 'Shared'],
      defaultAccountName: 'Account2',
      preferredCurrency: 'EUR',
    },
  ],
  SESSION_COOKIE: 'balance_session',
  USER_COOKIE: 'balance_user',
  ACCOUNT_COOKIE: 'balance_account',
  SESSION_TS_COOKIE: 'balance_session_ts',
  SESSION_MAX_AGE_MS: 30 * 24 * 60 * 60 * 1000, // 30 days
}))

// Import after mocks
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

// Helper factory for cookie store
function createMockCookieStore() {
  const store = new Map<string, string>()
  return {
    get: vi.fn((name: string) => {
      const value = store.get(name)
      return value ? { value } : undefined
    }),
    set: vi.fn((name: string, value: string) => {
      store.set(name, value)
    }),
    delete: vi.fn((name: string) => {
      store.delete(name)
    }),
    _store: store, // For test assertions
  }
}

describe('auth-server.ts', () => {
  let mockCookies: ReturnType<typeof createMockCookieStore>

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.stubEnv('AUTH_SESSION_SECRET', 'test-secret-key-must-be-at-least-32-characters-long-for-security')
    vi.stubEnv('NODE_ENV', 'production')
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    // Reset modules to pick up new env vars
    await vi.resetModules()

    // Create fresh cookie mock
    mockCookies = createMockCookieStore()
    vi.mocked(cookies).mockResolvedValue(mockCookies as never)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Phase 1: Foundation - Session establishment & validation', () => {
    describe('establishSession()', () => {
      it('should create session with all 4 cookies', async () => {
        const { establishSession } = await import('@/lib/auth-server')

        const result = await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Should return token
        expect(result).toHaveProperty('token')
        expect(result.token).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex = 64 chars

        // Should set all 4 cookies
        expect(mockCookies.set).toHaveBeenCalledTimes(4)
        expect(mockCookies.set).toHaveBeenCalledWith('balance_user', 'user1@test.com', expect.any(Object))
        expect(mockCookies.set).toHaveBeenCalledWith('balance_session', expect.any(String), expect.any(Object))
        expect(mockCookies.set).toHaveBeenCalledWith('balance_session_ts', expect.any(String), expect.any(Object))
        expect(mockCookies.set).toHaveBeenCalledWith('balance_account', 'acc123', expect.any(Object))
      })

      it('should generate unique tokens for different sessions at different times', async () => {
        const { establishSession } = await import('@/lib/auth-server')

        const result1 = await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Advance time by 1ms
        vi.setSystemTime(new Date('2024-01-15T12:00:00.001Z'))

        const result2 = await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        expect(result1.token).not.toBe(result2.token)
      })

      it('should use current timestamp for token generation', async () => {
        const { establishSession } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Check SESSION_TS_COOKIE was set with current timestamp
        const timestampCall = vi.mocked(mockCookies.set).mock.calls.find((call) => call[0] === 'balance_session_ts')
        expect(timestampCall).toBeDefined()
        expect(timestampCall![1]).toBe(String(Date.now()))
      })
    })

    describe('getSession() - Session validation', () => {
      it('should return valid session when all cookies present and valid', async () => {
        const { establishSession, getSession } = await import('@/lib/auth-server')

        // First establish a session
        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Now retrieve it
        const session = await getSession()

        expect(session).not.toBeNull()
        expect(session).toMatchObject({
          userEmail: 'user1@test.com',
          accountId: 'acc123',
        })
      })

      it('should return null when USER_COOKIE missing', async () => {
        const { establishSession, getSession } = await import('@/lib/auth-server')

        // Establish session
        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Delete USER_COOKIE from the internal store
        mockCookies._store.delete('balance_user')

        const session = await getSession()
        expect(session).toBeNull()
      })

      it('should return null when SESSION_COOKIE missing', async () => {
        const { establishSession, getSession } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Delete SESSION_COOKIE
        mockCookies._store.delete('balance_session')

        const session = await getSession()
        expect(session).toBeNull()
      })

      it('should return null when SESSION_TS_COOKIE missing', async () => {
        const { establishSession, getSession } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Delete SESSION_TS_COOKIE
        mockCookies._store.delete('balance_session_ts')

        const session = await getSession()
        expect(session).toBeNull()
      })

      it('should return session even when ACCOUNT_COOKIE missing (optional)', async () => {
        const { establishSession, getSession } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Delete ACCOUNT_COOKIE
        mockCookies._store.delete('balance_account')

        const session = await getSession()
        expect(session).not.toBeNull()
        expect(session).toMatchObject({
          userEmail: 'user1@test.com',
          accountId: undefined,
        })
      })

      it('should return null when token is invalid', async () => {
        const { establishSession, getSession } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Corrupt the token
        mockCookies._store.set('balance_session', 'invalid_token_with_64_characters_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')

        const session = await getSession()
        expect(session).toBeNull()
      })

      it('should return null when user email not in AUTH_USERS', async () => {
        const { establishSession, getSession } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Change email to unknown user
        mockCookies._store.set('balance_user', 'unknown@test.com')

        const session = await getSession()
        expect(session).toBeNull()
      })

      it('should successfully validate with original email casing', async () => {
        const { establishSession, getSession } = await import('@/lib/auth-server')

        // Establish session with specific casing
        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Retrieve session (should work with same casing)
        const session = await getSession()
        expect(session).not.toBeNull()
        expect(session?.userEmail).toBe('user1@test.com')
      })

      it('should return null for expired session (>30 days)', async () => {
        const { establishSession, getSession } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Advance time by 31 days
        const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000
        vi.setSystemTime(new Date(Date.now() + thirtyOneDaysMs))

        const session = await getSession()
        expect(session).toBeNull()
      })

      it('should return valid session at 29 days (within expiry window)', async () => {
        const { establishSession, getSession } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Advance time by 29 days
        const twentyNineDaysMs = 29 * 24 * 60 * 60 * 1000
        vi.setSystemTime(new Date(Date.now() + twentyNineDaysMs))

        const session = await getSession()
        expect(session).not.toBeNull()
        expect(session?.userEmail).toBe('user1@test.com')
      })
    })
  })

  describe('Phase 2: Core Auth - Credential verification', () => {
    describe('verifyCredentials()', () => {
      it('should return true for valid email and password', async () => {
        const { verifyCredentials } = await import('@/lib/auth-server')

        const result = await verifyCredentials({ email: 'user1@test.com', password: 'password123' })

        expect(result).toBe(true)
      })

      it('should return false for valid email but wrong password', async () => {
        const { verifyCredentials } = await import('@/lib/auth-server')

        const result = await verifyCredentials({ email: 'user1@test.com', password: 'wrongpassword' })

        expect(result).toBe(false)
      })

      it('should return false for unregistered email', async () => {
        const { verifyCredentials } = await import('@/lib/auth-server')

        const result = await verifyCredentials({ email: 'unknown@test.com', password: 'password123' })

        expect(result).toBe(false)
      })

      it('should normalize email: trim whitespace', async () => {
        const { verifyCredentials } = await import('@/lib/auth-server')

        const result = await verifyCredentials({ email: '  user1@test.com  ', password: 'password123' })

        expect(result).toBe(true)
      })

      it('should normalize email: case-insensitive', async () => {
        const { verifyCredentials } = await import('@/lib/auth-server')

        const result = await verifyCredentials({ email: 'USER1@TEST.COM', password: 'password123' })

        expect(result).toBe(true)
      })

      it('should handle whitespace in email and still fail for unknown user', async () => {
        const { verifyCredentials } = await import('@/lib/auth-server')

        const result = await verifyCredentials({ email: '  unknown@test.com  ', password: 'password123' })

        expect(result).toBe(false)
      })

      it('should handle empty email string', async () => {
        const { verifyCredentials } = await import('@/lib/auth-server')

        const result = await verifyCredentials({ email: '', password: 'password123' })

        expect(result).toBe(false)
      })

      it('should handle empty password string', async () => {
        const { verifyCredentials } = await import('@/lib/auth-server')

        const result = await verifyCredentials({ email: 'user1@test.com', password: '' })

        expect(result).toBe(false)
      })

      it('should work for second user with different password', async () => {
        const { verifyCredentials } = await import('@/lib/auth-server')

        const result = await verifyCredentials({ email: 'user2@test.com', password: 'securePass456' })

        expect(result).toBe(true)
      })
    })
  })

  describe('Phase 3: Session Management - Cleanup & enforcement', () => {
    describe('clearSession()', () => {
      it('should delete all 4 session cookies', async () => {
        const { establishSession, clearSession } = await import('@/lib/auth-server')

        // First establish a session
        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Clear the session
        await clearSession()

        // Verify all 4 cookies were deleted
        expect(mockCookies.delete).toHaveBeenCalledTimes(4)
        expect(mockCookies.delete).toHaveBeenCalledWith('balance_user')
        expect(mockCookies.delete).toHaveBeenCalledWith('balance_session')
        expect(mockCookies.delete).toHaveBeenCalledWith('balance_session_ts')
        expect(mockCookies.delete).toHaveBeenCalledWith('balance_account')
      })

      it('should handle when no cookies exist (idempotent)', async () => {
        const { clearSession } = await import('@/lib/auth-server')

        // Clear session without establishing one first
        await expect(clearSession()).resolves.not.toThrow()

        // Should still attempt to delete all cookies
        expect(mockCookies.delete).toHaveBeenCalledTimes(4)
      })

      it('should allow multiple calls without errors', async () => {
        const { clearSession } = await import('@/lib/auth-server')

        await clearSession()
        await clearSession()
        await clearSession()

        // Should be called 3 times × 4 cookies = 12 times
        expect(mockCookies.delete).toHaveBeenCalledTimes(12)
      })
    })

    describe('requireSession()', () => {
      it('should return session when authenticated', async () => {
        const { establishSession, requireSession } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        const session = await requireSession()

        expect(session).not.toBeNull()
        expect(session).toMatchObject({
          userEmail: 'user1@test.com',
          accountId: 'acc123',
        })
      })

      it('should throw error when not authenticated', async () => {
        const { requireSession } = await import('@/lib/auth-server')

        await expect(requireSession()).rejects.toThrow('Unauthenticated')
      })

      it('should throw with exact error message "Unauthenticated"', async () => {
        const { requireSession } = await import('@/lib/auth-server')

        try {
          await requireSession()
          expect.fail('Should have thrown error')
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
          expect((error as Error).message).toBe('Unauthenticated')
        }
      })

      it('should throw when session expired', async () => {
        const { establishSession, requireSession } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

        // Advance time beyond expiry
        const thirtyOneDaysMs = 31 * 24 * 60 * 60 * 1000
        vi.setSystemTime(new Date(Date.now() + thirtyOneDaysMs))

        await expect(requireSession()).rejects.toThrow('Unauthenticated')
      })
    })

    describe('getAuthUserFromSession()', () => {
      it('should return user for valid session', async () => {
        const { getAuthUserFromSession } = await import('@/lib/auth-server')

        const session = { userEmail: 'user1@test.com', accountId: 'acc123' }
        const user = getAuthUserFromSession(session)

        expect(user).toBeDefined()
        expect(user?.id).toBe('user1')
        expect(user?.email).toBe('user1@test.com')
        expect(user?.displayName).toBe('User One')
        expect(user?.accountNames).toEqual(['Account1', 'Shared'])
      })

      it('should return undefined for unknown email', async () => {
        const { getAuthUserFromSession } = await import('@/lib/auth-server')

        const session = { userEmail: 'unknown@test.com', accountId: 'acc123' }
        const user = getAuthUserFromSession(session)

        expect(user).toBeUndefined()
      })

      it('should be case-insensitive for email lookup', async () => {
        const { getAuthUserFromSession } = await import('@/lib/auth-server')

        const session = { userEmail: 'USER1@TEST.COM', accountId: 'acc123' }
        const user = getAuthUserFromSession(session)

        expect(user).toBeDefined()
        expect(user?.id).toBe('user1')
      })

      it('should work for second user', async () => {
        const { getAuthUserFromSession } = await import('@/lib/auth-server')

        const session = { userEmail: 'user2@test.com', accountId: 'acc456' }
        const user = getAuthUserFromSession(session)

        expect(user).toBeDefined()
        expect(user?.id).toBe('user2')
        expect(user?.displayName).toBe('User Two')
        expect(user?.accountNames).toEqual(['Account2', 'Shared'])
      })

      it('should handle email with whitespace (after normalization)', async () => {
        const { getAuthUserFromSession } = await import('@/lib/auth-server')

        // getAuthUserFromSession expects already-normalized email from session
        const session = { userEmail: 'user1@test.com', accountId: 'acc123' }
        const user = getAuthUserFromSession(session)

        expect(user).toBeDefined()
      })
    })
  })

  describe('Phase 4: Advanced Features - Account switching', () => {
    describe('updateSessionAccount()', () => {
      it('should successfully update account for valid switch', async () => {
        const { establishSession, updateSessionAccount } = await import('@/lib/auth-server')

        // Establish session for user1
        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc-account1' })

        // Mock account exists and user has access
        vi.mocked(prisma.account.findUnique).mockResolvedValue({
          id: 'acc-shared',
          name: 'Shared',
          balance: 1000,
          currency: 'USD',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        const result = await updateSessionAccount('acc-shared')

        expect(result).toEqual({ success: true })
        expect(prisma.account.findUnique).toHaveBeenCalledWith({ where: { id: 'acc-shared' } })
        expect(mockCookies.set).toHaveBeenCalledWith('balance_account', 'acc-shared', expect.any(Object))
      })

      it('should return error when no active session', async () => {
        const { updateSessionAccount } = await import('@/lib/auth-server')

        // No session established
        const result = await updateSessionAccount('acc-shared')

        expect(result).toEqual({ error: { general: ['No active session'] } })
      })

      it('should return error when account does not exist in database', async () => {
        const { establishSession, updateSessionAccount } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc-account1' })

        // Mock account not found
        vi.mocked(prisma.account.findUnique).mockResolvedValue(null)

        const result = await updateSessionAccount('acc-nonexistent')

        expect(result).toEqual({ error: { general: ['Account not found'] } })
      })

      it('should return error when account not in user authorized accounts', async () => {
        const { establishSession, updateSessionAccount } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc-account1' })

        // Mock Account2 which user1 doesn't have access to
        vi.mocked(prisma.account.findUnique).mockResolvedValue({
          id: 'acc-account2',
          name: 'Account2',
          balance: 1000,
          currency: 'USD',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        const result = await updateSessionAccount('acc-account2')

        expect(result).toEqual({ error: { general: ['Account is not available for this user'] } })
      })

      it('should allow switching to shared account for both users', async () => {
        const { establishSession, updateSessionAccount } = await import('@/lib/auth-server')

        // Test with user1
        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc-account1' })

        vi.mocked(prisma.account.findUnique).mockResolvedValue({
          id: 'acc-shared',
          name: 'Shared',
          balance: 1000,
          currency: 'USD',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        const result1 = await updateSessionAccount('acc-shared')
        expect(result1).toEqual({ success: true })

        // Now test with user2
        vi.clearAllMocks()
        mockCookies._store.clear()
        await establishSession({ userEmail: 'user2@test.com', accountId: 'acc-account2' })

        vi.mocked(prisma.account.findUnique).mockResolvedValue({
          id: 'acc-shared',
          name: 'Shared',
          balance: 1000,
          currency: 'USD',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        const result2 = await updateSessionAccount('acc-shared')
        expect(result2).toEqual({ success: true })
      })

      it('should enforce exact case-sensitive account name matching', async () => {
        const { establishSession, updateSessionAccount } = await import('@/lib/auth-server')

        await establishSession({ userEmail: 'user1@test.com', accountId: 'acc-account1' })

        // Mock account with lowercase name (user1 has 'Account1' not 'account1')
        vi.mocked(prisma.account.findUnique).mockResolvedValue({
          id: 'acc-wrong-case',
          name: 'account1', // lowercase
          balance: 1000,
          currency: 'USD',
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        const result = await updateSessionAccount('acc-wrong-case')

        expect(result).toEqual({ error: { general: ['Account is not available for this user'] } })
      })
    })
  })

  describe('Phase 5: Integration - End-to-end workflows', () => {
    it('should complete full login workflow: establish → get → verify', async () => {
      const { establishSession, getSession, getAuthUserFromSession } = await import('@/lib/auth-server')

      // 1. Establish session
      const { token } = await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })
      expect(token).toMatch(/^[a-f0-9]{64}$/)

      // 2. Get session
      const session = await getSession()
      expect(session).not.toBeNull()
      expect(session?.userEmail).toBe('user1@test.com')

      // 3. Verify user
      const user = getAuthUserFromSession(session!)
      expect(user?.id).toBe('user1')
      expect(user?.displayName).toBe('User One')
    })

    it('should complete full logout workflow: establish → clear → get', async () => {
      const { establishSession, clearSession, getSession } = await import('@/lib/auth-server')

      // 1. Establish session
      await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })
      const sessionBefore = await getSession()
      expect(sessionBefore).not.toBeNull()

      // 2. Clear session
      await clearSession()

      // 3. Get session (should be null)
      const sessionAfter = await getSession()
      expect(sessionAfter).toBeNull()
    })

    it('should complete account switching workflow: establish → switch → verify', async () => {
      const { establishSession, updateSessionAccount, getSession } = await import('@/lib/auth-server')

      // 1. Establish session with Account1
      await establishSession({ userEmail: 'user1@test.com', accountId: 'acc-account1' })
      const session1 = await getSession()
      expect(session1?.accountId).toBe('acc-account1')

      // 2. Switch to Shared account
      vi.mocked(prisma.account.findUnique).mockResolvedValue({
        id: 'acc-shared',
        name: 'Shared',
        balance: 1000,
        currency: 'USD',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await updateSessionAccount('acc-shared')
      expect(result).toEqual({ success: true })

      // 3. Verify account changed
      const session2 = await getSession()
      expect(session2?.accountId).toBe('acc-shared')
      expect(session2?.userEmail).toBe('user1@test.com') // User unchanged
    })

    it('should handle session expiry simulation across 31 days', async () => {
      const { establishSession, getSession } = await import('@/lib/auth-server')

      // Day 1: Establish session
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'))
      await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

      // Day 15: Still valid
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
      const session15 = await getSession()
      expect(session15).not.toBeNull()

      // Day 30: Still valid (exactly at boundary)
      vi.setSystemTime(new Date('2024-01-31T12:00:00Z'))
      const session30 = await getSession()
      expect(session30).not.toBeNull()

      // Day 32: Expired (beyond 30 days)
      vi.setSystemTime(new Date('2024-02-02T12:00:00Z'))
      const session32 = await getSession()
      expect(session32).toBeNull()
    })

    it('should enforce authentication with requireSession throughout workflow', async () => {
      const { establishSession, requireSession, clearSession } = await import('@/lib/auth-server')

      // Before login: should throw
      await expect(requireSession()).rejects.toThrow('Unauthenticated')

      // After login: should succeed
      await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })
      const session = await requireSession()
      expect(session.userEmail).toBe('user1@test.com')

      // After logout: should throw again
      await clearSession()
      await expect(requireSession()).rejects.toThrow('Unauthenticated')
    })
  })

  describe('Environment & Configuration', () => {
    it('should use secure=true in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')
      await vi.resetModules()

      const { establishSession } = await import('@/lib/auth-server')
      await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

      // Check that cookies were set with secure: true
      expect(mockCookies.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ secure: true }),
      )
    })

    it('should use secure=false in development', async () => {
      vi.stubEnv('NODE_ENV', 'development')
      await vi.resetModules()

      const { establishSession } = await import('@/lib/auth-server')
      await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

      // Check that cookies were set with secure: false
      expect(mockCookies.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({ secure: false }),
      )
    })

    it('should always use httpOnly, sameSite lax, and path /', async () => {
      await vi.resetModules()

      const { establishSession } = await import('@/lib/auth-server')
      await establishSession({ userEmail: 'user1@test.com', accountId: 'acc123' })

      // Check all cookie config properties
      expect(mockCookies.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        }),
      )
    })
  })
})
