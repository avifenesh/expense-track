import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCsrfToken } from '@/lib/csrf'
import { generateNonce } from '@/lib/nonce'

export async function proxy(_request: NextRequest) {
  // Generate unique nonce for this request
  const nonce = generateNonce()

  await getCsrfToken()

  const isDev = process.env.NODE_ENV === 'development'

  // Build CSP with nonce for scripts, unsafe-inline for styles (React inline styles)
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.frankfurter.app https://*.ingest.sentry.io",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')

  // Create response
  const response = NextResponse.next()

  // Store nonce in request headers for access in Server Components
  response.headers.set('x-nonce', nonce)

  const headers = response.headers

  headers.set('Content-Security-Policy', csp)
  headers.set('X-Frame-Options', 'DENY')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

  if (process.env.NODE_ENV === 'production') {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  }

  return response
}
