import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockCookies = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve(mockCookies),
}))

process.env.AUTH_SESSION_SECRET = 'test-secret-key-for-csrf-testing-only'

import { getCsrfToken, validateCsrfToken, rotateCsrfToken, CSRF_COOKIE } from '@/lib/csrf'

describe('CSRF Token Library', () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    // Force production mode for CSRF tests (integration tests use 'test' mode to skip validation)
    // @ts-expect-error - NODE_ENV is read-only in types, but writable at runtime
    process.env.NODE_ENV = 'production'
    vi.clearAllMocks()
    mockCookies.get.mockReturnValue(undefined)
  })

  afterEach(() => {
    // Restore original NODE_ENV
    // @ts-expect-error - NODE_ENV is read-only in types, but writable at runtime
    process.env.NODE_ENV = originalNodeEnv
  })

  describe('getCsrfToken', () => {
    it('generates new token if none exists', async () => {
      const token = await getCsrfToken()

      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(20)
      expect(mockCookies.set).toHaveBeenCalledWith(
        CSRF_COOKIE,
        expect.stringContaining('.'),
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
        }),
      )
    })

    it('returns existing valid token from cookie', async () => {
      const token1 = await getCsrfToken()
      const signedToken = mockCookies.set.mock.calls[0][1]

      mockCookies.get.mockReturnValue({ value: signedToken })

      const token2 = await getCsrfToken()

      expect(token2).toBe(token1)
    })

    it('regenerates if cookie signature is invalid', async () => {
      mockCookies.get.mockReturnValue({ value: 'invalid.signature' })

      const token = await getCsrfToken()

      expect(token).toBeTruthy()
      expect(mockCookies.set).toHaveBeenCalled()
    })

    it('regenerates if cookie format is malformed', async () => {
      mockCookies.get.mockReturnValue({ value: 'nosignature' })

      const token = await getCsrfToken()

      expect(token).toBeTruthy()
      expect(mockCookies.set).toHaveBeenCalled()
    })
  })

  describe('validateCsrfToken', () => {
    it('returns true for valid matching token', async () => {
      const token = await getCsrfToken()
      const signedToken = mockCookies.set.mock.calls[0][1]

      mockCookies.get.mockReturnValue({ value: signedToken })

      const valid = await validateCsrfToken(token)

      expect(valid).toBe(true)
    })

    it('returns false for mismatched token', async () => {
      await getCsrfToken()
      const signedToken = mockCookies.set.mock.calls[0][1]

      mockCookies.get.mockReturnValue({ value: signedToken })

      const valid = await validateCsrfToken('wrong-token')

      expect(valid).toBe(false)
    })

    it('returns false if no token submitted', async () => {
      const valid = await validateCsrfToken(undefined)
      expect(valid).toBe(false)
    })

    it('returns false for null token', async () => {
      const valid = await validateCsrfToken(null)
      expect(valid).toBe(false)
    })

    it('returns false for empty string token', async () => {
      const valid = await validateCsrfToken('')
      expect(valid).toBe(false)
    })

    it('returns false if no cookie exists', async () => {
      mockCookies.get.mockReturnValue(undefined)

      const valid = await validateCsrfToken('some-token')

      expect(valid).toBe(false)
    })

    it('returns false if cookie signature is invalid', async () => {
      mockCookies.get.mockReturnValue({ value: 'invalid.signature' })

      const valid = await validateCsrfToken('some-token')

      expect(valid).toBe(false)
    })

    it('returns false if cookie format is malformed', async () => {
      mockCookies.get.mockReturnValue({ value: 'malformed-no-dot' })

      const valid = await validateCsrfToken('some-token')

      expect(valid).toBe(false)
    })
  })

  describe('rotateCsrfToken', () => {
    it('deletes old token and generates new one', async () => {
      const newToken = await rotateCsrfToken()

      expect(mockCookies.delete).toHaveBeenCalledWith(CSRF_COOKIE)
      expect(newToken).toBeTruthy()
      expect(mockCookies.set).toHaveBeenCalled()
    })

    it('generates different token on rotation', async () => {
      const token1 = await getCsrfToken()
      vi.clearAllMocks()

      const token2 = await rotateCsrfToken()

      expect(token2).not.toBe(token1)
    })
  })

  describe('Security properties', () => {
    it('generates cryptographically random tokens', async () => {
      const tokens = new Set()

      for (let i = 0; i < 100; i++) {
        mockCookies.get.mockReturnValue(undefined)
        const token = await getCsrfToken()
        tokens.add(token)
        vi.clearAllMocks()
      }

      expect(tokens.size).toBe(100)
    })

    it('signs tokens with HMAC to prevent tampering', async () => {
      const token = await getCsrfToken()
      const signedToken = mockCookies.set.mock.calls[0][1]

      expect(signedToken.split('.').length).toBe(2)

      const [plainToken] = signedToken.split('.')
      const tamperedSigned = plainToken + '.fakesignature'

      mockCookies.get.mockReturnValue({ value: tamperedSigned })

      const valid = await validateCsrfToken(token)
      expect(valid).toBe(false)
    })

    it('handles timing attack attempts gracefully', async () => {
      const token = await getCsrfToken()
      const signedToken = mockCookies.set.mock.calls[0][1]

      mockCookies.get.mockReturnValue({ value: signedToken })

      const similarToken = token.slice(0, -1) + 'X'
      const valid = await validateCsrfToken(similarToken)

      expect(valid).toBe(false)
    })
  })

  describe('Cookie configuration', () => {
    it('sets httpOnly flag to prevent JavaScript access', async () => {
      await getCsrfToken()

      const setCall = mockCookies.set.mock.calls[0]
      expect(setCall[2].httpOnly).toBe(true)
    })

    it('sets sameSite to lax for CSRF protection', async () => {
      await getCsrfToken()

      const setCall = mockCookies.set.mock.calls[0]
      expect(setCall[2].sameSite).toBe('lax')
    })

    it('sets path to root', async () => {
      await getCsrfToken()

      const setCall = mockCookies.set.mock.calls[0]
      expect(setCall[2].path).toBe('/')
    })

    it('sets 30-day expiry', async () => {
      await getCsrfToken()

      const setCall = mockCookies.set.mock.calls[0]
      expect(setCall[2].maxAge).toBe(60 * 60 * 24 * 30)
    })

    it('sets secure flag in production', async () => {
      vi.stubEnv('NODE_ENV', 'production')

      await getCsrfToken()

      const setCall = mockCookies.set.mock.calls[0]
      expect(setCall[2].secure).toBe(true)

      vi.unstubAllEnvs()
    })

    it('does not set secure flag in development', async () => {
      vi.stubEnv('NODE_ENV', 'development')

      await getCsrfToken()

      const setCall = mockCookies.set.mock.calls[0]
      expect(setCall[2].secure).toBe(false)

      vi.unstubAllEnvs()
    })
  })
})
