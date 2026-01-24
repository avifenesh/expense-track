const DEFAULT_DATABASE_URL = 'postgresql://test:test@localhost:5432/expense_track_test?schema=public'
const DEFAULT_JWT_SECRET = 'test-jwt-secret-for-local-development-32chars'
const DEFAULT_AUTH_SESSION_SECRET = 'test-auth-session-secret-for-local-development-32chars'

process.env.DATABASE_URL ||= DEFAULT_DATABASE_URL
process.env.JWT_SECRET ||= DEFAULT_JWT_SECRET
process.env.AUTH_SESSION_SECRET ||= DEFAULT_AUTH_SESSION_SECRET
process.env.VITEST ||= 'true'
