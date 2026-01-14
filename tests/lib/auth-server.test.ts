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
})
