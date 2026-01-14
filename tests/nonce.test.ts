import { describe, it, expect } from 'vitest'
import { generateNonce } from '@/lib/nonce'

describe('generateNonce', () => {
  it('generates a base64url string', () => {
    const nonce = generateNonce()

    // Base64url characters: A-Z, a-z, 0-9, -, _
    expect(nonce).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('generates 22-character string (16 bytes base64url encoded)', () => {
    const nonce = generateNonce()

    // 16 bytes = 128 bits → base64url = 22 chars (no padding)
    expect(nonce).toHaveLength(22)
  })

  it('generates unique values on each call', () => {
    const nonces = new Set<string>()

    // Generate 1000 nonces
    for (let i = 0; i < 1000; i++) {
      nonces.add(generateNonce())
    }

    // All should be unique
    expect(nonces.size).toBe(1000)
  })

  it('produces cryptographically random output', () => {
    // Generate multiple nonces and verify they have high entropy
    const nonces = Array.from({ length: 100 }, () => generateNonce())

    // Check that there's no obvious pattern (all different)
    const uniqueNonces = new Set(nonces)
    expect(uniqueNonces.size).toBe(100)

    // Check that characters are distributed (not all same char)
    nonces.forEach((nonce) => {
      const uniqueChars = new Set(nonce.split(''))
      expect(uniqueChars.size).toBeGreaterThan(10) // Should have variety
    })
  })
})
