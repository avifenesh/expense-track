import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@/lib/csrf', () => ({
  getCsrfToken: vi.fn().mockResolvedValue('mock-token'),
}))

import { middleware } from '@/middleware'
import { getCsrfToken } from '@/lib/csrf'

describe('Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sets X-Frame-Options header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await middleware(request)

    expect(response.headers.get('X-Frame-Options')).toBe('DENY')
  })

  it('sets X-Content-Type-Options header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await middleware(request)

    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('sets Referrer-Policy header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await middleware(request)

    expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('sets Permissions-Policy header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await middleware(request)

    expect(response.headers.get('Permissions-Policy')).toBe('camera=(), microphone=(), geolocation=()')
  })

  it('sets Content-Security-Policy header', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await middleware(request)

    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toBeTruthy()
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('CSP includes api.frankfurter.app in connect-src', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await middleware(request)

    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toContain('api.frankfurter.app')
  })

  it('CSP allows unsafe-inline for scripts and styles', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await middleware(request)

    const csp = response.headers.get('Content-Security-Policy')
    expect(csp).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'")
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
  })

  it('ensures CSRF token exists', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    await middleware(request)

    expect(getCsrfToken).toHaveBeenCalled()
  })

  it('sets Strict-Transport-Security in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const request = new NextRequest(new URL('http://localhost:3000/'))
    const response = await middleware(request)

    expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains')

    vi.unstubAllEnvs()
  })

  it('does not set Strict-Transport-Security in development', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    const request = new NextRequest(new URL('http://localhost:3000/'))
    const response = await middleware(request)

    expect(response.headers.get('Strict-Transport-Security')).toBeNull()

    vi.unstubAllEnvs()
  })

  it('returns NextResponse that allows request to continue', async () => {
    const request = new NextRequest(new URL('http://localhost:3000/'))

    const response = await middleware(request)

    expect(response).toBeInstanceOf(NextResponse)
  })
})
