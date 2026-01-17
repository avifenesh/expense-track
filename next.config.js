const { withSentryConfig } = require('@sentry/nextjs')

const ALLOWED_DEV_ORIGINS = ['127.0.0.1']

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ALLOWED_DEV_ORIGINS,
  experimental: {
    serverActions: {},
  },
  proxy: {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
  },
}

// Sentry configuration
const sentryWebpackPluginOptions = {
  // Upload source maps only in production
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
}

// Validate Sentry configuration at build time
const isSentryEnabled = process.env.SENTRY_ENABLED === 'true'

if (isSentryEnabled) {
  const missingVars = []

  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    missingVars.push('SENTRY_DSN or NEXT_PUBLIC_SENTRY_DSN')
  }

  if (missingVars.length > 0) {
    throw new Error(
      `Sentry is enabled (SENTRY_ENABLED=true) but required configuration is missing:\n` +
        `  Missing: ${missingVars.join(', ')}\n\n` +
        `Either set the missing variables or disable Sentry by setting SENTRY_ENABLED=false.\n` +
        `See .env.example for configuration details.`
    )
  }

  // Note: Source map upload config (SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN) is optional.
  // If not configured, Sentry will work but error reports won't have source maps.
  // This is intentionally not logged per repo logging rules (no console.*).
}

// Only apply Sentry in production builds
module.exports = isSentryEnabled ? withSentryConfig(nextConfig, sentryWebpackPluginOptions) : nextConfig
