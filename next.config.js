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

// Only apply Sentry in production builds
module.exports =
  process.env.SENTRY_ENABLED === 'true' ? withSentryConfig(nextConfig, sentryWebpackPluginOptions) : nextConfig
