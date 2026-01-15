import 'server-only'
import * as Sentry from '@sentry/nextjs'

const SENTRY_DSN = process.env.SENTRY_DSN
const SENTRY_ENVIRONMENT = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development'
const SENTRY_ENABLED = process.env.SENTRY_ENABLED === 'true'

if (SENTRY_DSN && SENTRY_ENABLED) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: SENTRY_ENVIRONMENT,

    // Performance monitoring
    tracesSampleRate: SENTRY_ENVIRONMENT === 'production' ? 0.1 : 1.0,

    // Session replay (optional, disabled by default for privacy)
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    // Integrations
    integrations: [
      Sentry.prismaIntegration(),
      Sentry.httpIntegration(),
    ],

    // Filter sensitive data
    beforeSend(event) {
      // Remove sensitive headers
      if (event.request?.headers) {
        delete event.request.headers['cookie']
        delete event.request.headers['authorization']
      }
      return event
    },

    // Ignore common noise
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'Non-Error promise rejection captured',
    ],
  })
}

export { Sentry }
