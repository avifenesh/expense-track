---
paths:
  - "src/lib/auth.ts"
  - "src/lib/auth-server.ts"
  - "src/lib/csrf.ts"
  - "src/lib/jwt.ts"
  - "src/middleware.ts"
  - "src/lib/api-auth.ts"
---

# Security Implementation Rules

## CSRF Protection

### Double-Submit Cookie Pattern
- Token stored in `balance_csrf` cookie (httpOnly, sameSite: lax)
- Token signed with HMAC-SHA256 using `AUTH_SESSION_SECRET`
- Client submits token via form data, server validates against cookie

```typescript
// Server action
const csrfCheck = await requireCsrfToken(data.csrfToken)
if ('error' in csrfCheck) return csrfCheck

// Uses timing-safe comparison
crypto.timingSafeEqual(Buffer.from(submittedToken), Buffer.from(cookieToken))
```

## JWT Authentication (API Routes)

### Token Types
- **Access Token**: 15-minute expiry, used for API requests
- **Refresh Token**: 30-day expiry, stored in RefreshToken table with JTI

```typescript
import { verifyAccessToken, verifyRefreshToken } from '@/lib/jwt'

const payload = verifyAccessToken(token)  // { userId, email, type: 'access' }
const payload = verifyRefreshToken(token) // { userId, email, type: 'refresh', jti }
```

### Token Revocation
- Refresh tokens tracked in database with `jti` (JWT ID)
- Delete from `RefreshToken` table to revoke
- Access tokens cannot be revoked (short-lived by design)

## Session Management

### Cookies
- `balance_session`: Session token
- `balance_user`: User email
- `balance_account`: Active account ID
- `balance_session_ts`: Timestamp nonce
- `balance_csrf`: CSRF token

### Session Duration
```typescript
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000  // 30 days
```

## Security Headers (Middleware)

```typescript
// Content Security Policy
`script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`
`style-src 'self' 'nonce-${nonce}'`

// Other headers
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000; includeSubDomains (production only)
```

## XSS Prevention

- React JSX automatically escapes text content
- Never use `dangerouslySetInnerHTML`
- All user input validated via Zod schemas
- Never reflect user input in error messages
- Use predefined error strings

## Environment Variables Required

```
AUTH_SESSION_SECRET  # CSRF token signing
JWT_SECRET           # JWT signing
```

Never expose these in client code or logs.
