/**
 * Next.js Instrumentation Hook
 *
 * Initializes monitoring and observability tools during app startup.
 * Runs once when the Next.js server starts (not per request).
 *
 * Supported in Next.js 15+ for both server and edge runtimes.
 */

export async function register() {
  // Only initialize Sentry in production or when explicitly enabled
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Import server Sentry config
    await import('./lib/monitoring/sentry-server')
  }

  // Edge runtime support (optional, not implemented yet)
  // if (process.env.NEXT_RUNTIME === 'edge') {
  //   await import('./lib/monitoring/sentry-edge')
  // }
}
