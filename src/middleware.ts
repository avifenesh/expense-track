import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCsrfToken } from '@/lib/csrf'
import { generateNonce } from '@/lib/nonce'

export async function middleware(_request: NextRequest) {
  // Generate unique nonce for this request
  const nonce = generateNonce()

  await getCsrfToken()

  const isDev = process.env.NODE_ENV === 'development'

  // Build CSP with nonce
  const csp = [
    "default-src 'self'",
    // Development: Keep unsafe-eval for HMR, add nonce for framework scripts
    // Production: Use nonce + strict-dynamic for modern browsers
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Development: Keep unsafe-inline for Tailwind HMR
    // Production: Use nonce for any inline styles (though we have none)
    `style-src 'self' 'nonce-${nonce}'${isDev ? " 'unsafe-inline'" : ''}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://api.frankfurter.app",
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

export const config = {
  matcher: [
    {
      source: '/((?:(?!_next/static|_next/image|favicon.ico|.*.(svg|png|jpg|jpeg|gif|webp)$)).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
  runtime: 'nodejs',
}
