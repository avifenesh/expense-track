import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getCsrfToken } from '@/lib/csrf'
import { generateNonce } from '@/lib/nonce'

export async function middleware(request: NextRequest) {
  // Generate unique nonce for this request
  const nonce = generateNonce()

  await getCsrfToken()

  const isDev = process.env.NODE_ENV === 'development'
  const isApiDocs = request.nextUrl.pathname.startsWith('/api-docs')

  // Build CSP with nonce
  // API docs page needs relaxed CSP for Swagger UI inline styles
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'nonce-${nonce}'${isDev || isApiDocs ? " 'unsafe-inline'" : ''}`,
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

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
  runtime: 'nodejs',
}
