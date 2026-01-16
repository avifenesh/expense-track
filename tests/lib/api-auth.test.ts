import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import jwt from 'jsonwebtoken'

// Mock prisma before importing modules that depend on it
vi.mock('@/lib/prisma', () => ({
  prisma: {
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { extractBearerToken, requireJwtAuth } from '@/lib/api-auth'
import { generateAccessToken, generateRefreshToken } from '@/lib/jwt'

describe('api-auth.ts', () => {
  const testSecret = 'test-secret-key-for-jwt-testing'

  beforeEach(() => {
    process.env.JWT_SECRET = testSecret
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('extractBearerToken', () => {
    it('should extract valid Bearer token from Authorization header', () => {
      const token = 'test-jwt-token'
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: `Bearer ${token}` },
      })

      const result = extractBearerToken(request)
      expect(result).toBe(token)
    })

    it('should extract token with proper Bearer format', () => {
      const token = generateAccessToken('test-user', 'test@example.com')
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: `Bearer ${token}` },
      })

      const result = extractBearerToken(request)
      expect(result).toBe(token)
    })

    it('should return null when Authorization header is missing', () => {
      const request = new NextRequest('http://localhost:3000/')

      const result = extractBearerToken(request)
      expect(result).toBeNull()
    })

    it('should return null when Authorization header lacks Bearer prefix', () => {
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: 'test-token' },
      })

      const result = extractBearerToken(request)
      expect(result).toBeNull()
    })

    it('should return null when token is just "Bearer " with trailing space', () => {
      // NextRequest or the headers API might normalize "Bearer " to "Bearer" (trim trailing space)
      // causing startsWith check to fail
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: 'Bearer ' },
      })

      const result = extractBearerToken(request)
      expect(result).toBeNull() // Header normalization causes startsWith to fail
    })

    it('should return null for wrong auth scheme (Basic)', () => {
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: 'Basic dXNlcjpwYXNz' },
      })

      const result = extractBearerToken(request)
      expect(result).toBeNull()
    })

    it('should return null for case-sensitive bearer (lowercase)', () => {
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: 'bearer test-token' },
      })

      const result = extractBearerToken(request)
      expect(result).toBeNull()
    })

    it('should handle multiple spaces after Bearer', () => {
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: 'Bearer  token-with-space' },
      })

      const result = extractBearerToken(request)
      expect(result).toBe(' token-with-space') // Returns with leading space
    })

    it('should extract token when Authorization has leading whitespace (trimmed by browser/NextRequest)', () => {
      // Note: In practice, HTTP headers are often trimmed by browsers/servers
      // NextRequest might trim the value, so " Bearer token" becomes "Bearer token"
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: ' Bearer test-token' },
      })

      const result = extractBearerToken(request)
      // Browser/NextRequest trims header values, so this actually extracts successfully
      expect(result).toBe('test-token')
    })

    it('should extract token containing spaces', () => {
      const tokenWithSpaces = 'token with internal spaces'
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: `Bearer ${tokenWithSpaces}` },
      })

      const result = extractBearerToken(request)
      expect(result).toBe(tokenWithSpaces)
    })
  })

  describe('requireJwtAuth', () => {
    it('should return user data for valid access token', () => {
      const token = generateAccessToken('test-user', 'test@example.com')
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: `Bearer ${token}` },
      })

      const result = requireJwtAuth(request)
      expect(result).toEqual({
        userId: 'test-user',
        email: 'test@example.com',
      })
    })

    it('should correctly extract user data from token payload', () => {
      const token = generateAccessToken('other-user', 'other@example.com')
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: `Bearer ${token}` },
      })

      const result = requireJwtAuth(request)
      expect(result.userId).toBe('other-user')
      expect(result.email).toBe('other@example.com')
    })

    it('should throw "Missing authorization token" when Authorization header is missing', () => {
      const request = new NextRequest('http://localhost:3000/')

      expect(() => requireJwtAuth(request)).toThrow('Missing authorization token')
    })

    it('should throw "Missing authorization token" when Authorization lacks Bearer prefix', () => {
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: 'test-token' },
      })

      expect(() => requireJwtAuth(request)).toThrow('Missing authorization token')
    })

    it('should throw "Missing authorization token" for empty token after Bearer', () => {
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: 'Bearer ' },
      })

      expect(() => requireJwtAuth(request)).toThrow('Missing authorization token')
    })

    it('should throw "Invalid token" for tampered token signature', () => {
      // Create token signed with wrong secret
      const tamperedToken = jwt.sign(
        { userId: 'test-user', email: 'test@example.com', type: 'access' },
        'wrong-secret',
        {
          expiresIn: '15m',
        },
      )
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: `Bearer ${tamperedToken}` },
      })

      expect(() => requireJwtAuth(request)).toThrow('Invalid token')
    })

    it('should throw "Token expired" for expired access token', () => {
      // Create intentionally expired token
      const expiredToken = jwt.sign(
        { userId: 'test-user', email: 'test@example.com', type: 'access' },
        testSecret,
        { expiresIn: '-1s' }, // Expired 1 second ago
      )
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: `Bearer ${expiredToken}` },
      })

      expect(() => requireJwtAuth(request)).toThrow('Token expired')
    })

    it('should throw "Invalid token" for wrong token type (refresh instead of access)', () => {
      const { token: refreshToken } = generateRefreshToken('test-user', 'test@example.com')
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: `Bearer ${refreshToken}` },
      })

      expect(() => requireJwtAuth(request)).toThrow('Invalid token')
    })

    it('should throw "Invalid token" for malformed JWT string', () => {
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: 'Bearer not.a.valid.jwt' },
      })

      expect(() => requireJwtAuth(request)).toThrow('Invalid token')
    })

    it('should return user with undefined userId for token with missing userId claim', () => {
      // Create token without userId claim
      // Note: verifyAccessToken doesn't validate claim presence, just signature/expiry
      const incompleteToken = jwt.sign({ email: 'test@example.com', type: 'access' }, testSecret, { expiresIn: '15m' })
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: `Bearer ${incompleteToken}` },
      })

      const result = requireJwtAuth(request)
      // JWT validates signature and expiry, but doesn't enforce required fields
      expect(result.userId).toBeUndefined()
      expect(result.email).toBe('test@example.com')
    })

    it('should throw "Invalid token" for non-JWT random text', () => {
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: 'Bearer random-text-not-jwt' },
      })

      expect(() => requireJwtAuth(request)).toThrow('Invalid token')
    })

    it('should successfully extract and verify token in full integration', () => {
      const token = generateAccessToken('test-user', 'test@example.com')
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: `Bearer ${token}` },
      })

      const extractedToken = extractBearerToken(request)
      expect(extractedToken).toBeTruthy()

      const user = requireJwtAuth(request)
      expect(user.userId).toBe('test-user')
      expect(user.email).toBe('test@example.com')
    })

    it('should handle error chain: missing header -> extraction null -> missing token error', () => {
      const request = new NextRequest('http://localhost:3000/')

      const extractedToken = extractBearerToken(request)
      expect(extractedToken).toBeNull()

      expect(() => requireJwtAuth(request)).toThrow('Missing authorization token')
    })

    it('should handle error chain: valid extraction -> verification fails -> token error', () => {
      const invalidToken = 'invalid-jwt-token'
      const request = new NextRequest('http://localhost:3000/', {
        headers: { authorization: `Bearer ${invalidToken}` },
      })

      const extractedToken = extractBearerToken(request)
      expect(extractedToken).toBe(invalidToken)

      expect(() => requireJwtAuth(request)).toThrow('Invalid token')
    })
  })
})
