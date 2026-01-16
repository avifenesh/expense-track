import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import jwt from 'jsonwebtoken'
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  type TokenPayload,
} from '@/lib/jwt'

describe('JWT Token Generation', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt-testing'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateAccessToken', () => {
    it('should generate a valid access token', () => {
      const token = generateAccessToken('test-user', 'test@example.com')
      expect(token).toBeTruthy()
      expect(typeof token).toBe('string')
      const decoded = jwt.decode(token) as TokenPayload
      expect(decoded.userId).toBe('test-user')
      expect(decoded.email).toBe('test@example.com')
      expect(decoded.type).toBe('access')
      expect(decoded.jti).toBeUndefined()
    })

    it('should throw when JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET
      expect(() => generateAccessToken('test-user', 'test@example.com')).toThrow(
        'JWT_SECRET environment variable is required',
      )
    })

    it('should include expiry in token', () => {
      const token = generateAccessToken('test-user', 'test@example.com')
      const decoded = jwt.decode(token) as TokenPayload & { exp: number; iat: number }
      expect(decoded.exp).toBeDefined()
      expect(decoded.iat).toBeDefined()
      expect(decoded.exp - decoded.iat).toBe(15 * 60)
    })
  })

  describe('generateRefreshToken', () => {
    it('should generate a valid refresh token with JTI', () => {
      const result = generateRefreshToken('other-user', 'other@example.com')
      expect(result.token).toBeTruthy()
      expect(result.jti).toBeTruthy()
      expect(result.jti).toHaveLength(64)
      expect(result.expiresAt).toBeInstanceOf(Date)
      const decoded = jwt.decode(result.token) as TokenPayload
      expect(decoded.userId).toBe('other-user')
      expect(decoded.email).toBe('other@example.com')
      expect(decoded.type).toBe('refresh')
      expect(decoded.jti).toBe(result.jti)
    })

    it('should generate unique JTI for each token', () => {
      const result1 = generateRefreshToken('test-user', 'test@example.com')
      const result2 = generateRefreshToken('test-user', 'test@example.com')
      expect(result1.jti).not.toBe(result2.jti)
    })

    it('should set expiry to 30 days from now', () => {
      const before = Date.now()
      const result = generateRefreshToken('test-user', 'test@example.com')
      const after = Date.now()
      const expectedExpiry = 30 * 24 * 60 * 60 * 1000
      const actualExpiry = result.expiresAt.getTime()
      expect(actualExpiry).toBeGreaterThanOrEqual(before + expectedExpiry)
      expect(actualExpiry).toBeLessThanOrEqual(after + expectedExpiry)
    })

    it('should throw when JWT_SECRET is missing', () => {
      delete process.env.JWT_SECRET
      expect(() => generateRefreshToken('test-user', 'test@example.com')).toThrow(
        'JWT_SECRET environment variable is required',
      )
    })
  })
})

describe('JWT Token Validation', () => {
  const secret = 'test-secret-key-for-jwt-testing'

  beforeEach(() => {
    process.env.JWT_SECRET = secret
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = generateAccessToken('test-user', 'test@example.com')
      const payload = verifyAccessToken(token)
      expect(payload.userId).toBe('test-user')
      expect(payload.email).toBe('test@example.com')
      expect(payload.type).toBe('access')
    })

    it('should reject expired access token', () => {
      const expiredToken = jwt.sign({ userId: 'test-user', email: 'test@example.com', type: 'access' }, secret, {
        expiresIn: '-1s',
      })
      expect(() => verifyAccessToken(expiredToken)).toThrow()
    })

    it('should reject token with wrong secret', () => {
      const token = jwt.sign({ userId: 'test-user', email: 'test@example.com', type: 'access' }, 'wrong-secret', {
        expiresIn: '15m',
      })
      expect(() => verifyAccessToken(token)).toThrow()
    })

    it('should reject tampered token', () => {
      const token = generateAccessToken('test-user', 'test@example.com')
      const tamperedToken = token.slice(0, -5) + 'xxxxx'
      expect(() => verifyAccessToken(tamperedToken)).toThrow()
    })

    it('should reject refresh token used as access token', () => {
      const { token } = generateRefreshToken('test-user', 'test@example.com')
      expect(() => verifyAccessToken(token)).toThrow('Invalid token type')
    })

    it('should reject token with wrong type field', () => {
      const token = jwt.sign({ userId: 'test-user', email: 'test@example.com', type: 'wrong' }, secret, {
        expiresIn: '15m',
      })
      expect(() => verifyAccessToken(token)).toThrow('Invalid token type')
    })

    it('should throw when JWT_SECRET is missing', () => {
      const token = generateAccessToken('test-user', 'test@example.com')
      delete process.env.JWT_SECRET
      expect(() => verifyAccessToken(token)).toThrow('JWT_SECRET environment variable is required')
    })
  })

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const { token } = generateRefreshToken('other-user', 'other@example.com')
      const payload = verifyRefreshToken(token)
      expect(payload.userId).toBe('other-user')
      expect(payload.email).toBe('other@example.com')
      expect(payload.type).toBe('refresh')
      expect(payload.jti).toBeTruthy()
      expect(payload.jti).toHaveLength(64)
    })

    it('should reject expired refresh token', () => {
      const expiredToken = jwt.sign(
        { userId: 'test-user', email: 'test@example.com', type: 'refresh', jti: 'test-jti' },
        secret,
        { expiresIn: '-1s' },
      )
      expect(() => verifyRefreshToken(expiredToken)).toThrow()
    })

    it('should reject token with wrong secret', () => {
      const token = jwt.sign(
        { userId: 'test-user', email: 'test@example.com', type: 'refresh', jti: 'test-jti' },
        'wrong-secret',
        { expiresIn: '30d' },
      )
      expect(() => verifyRefreshToken(token)).toThrow()
    })

    it('should reject access token used as refresh token', () => {
      const token = generateAccessToken('test-user', 'test@example.com')
      expect(() => verifyRefreshToken(token)).toThrow('Invalid token type')
    })

    it('should reject refresh token without JTI', () => {
      const token = jwt.sign({ userId: 'test-user', email: 'test@example.com', type: 'refresh' }, secret, {
        expiresIn: '30d',
      })
      expect(() => verifyRefreshToken(token)).toThrow('Invalid token type')
    })

    it('should throw when JWT_SECRET is missing', () => {
      const { token } = generateRefreshToken('test-user', 'test@example.com')
      delete process.env.JWT_SECRET
      expect(() => verifyRefreshToken(token)).toThrow('JWT_SECRET environment variable is required')
    })
  })
})
