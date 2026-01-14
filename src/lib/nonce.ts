import 'server-only'

import crypto from 'node:crypto'

/**
 * Generate a cryptographically secure nonce for CSP.
 *
 * Returns a 22-character base64url-encoded string (16 bytes of entropy = 128 bits).
 * Each nonce should be unique per request to prevent replay attacks.
 *
 * @returns A base64url-encoded nonce string
 */
export function generateNonce(): string {
  // Generate 16 bytes (128 bits) of cryptographic entropy
  // Base64url encoding is URL-safe and doesn't require padding removal
  return crypto.randomBytes(16).toString('base64url')
}
