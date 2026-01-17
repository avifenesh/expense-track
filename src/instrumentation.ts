/** Next.js instrumentation hook - initializes Sentry on server startup */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./lib/monitoring/sentry-server')
  }
}
