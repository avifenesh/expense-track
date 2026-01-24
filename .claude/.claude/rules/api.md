---
paths: ['src/app/api/**']
---

# API Endpoint Rules

## JWT Authentication

```typescript
import { requireJwtAuth } from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  let user
  try {
    user = requireJwtAuth(request)
  } catch (error) {
    return authError(error instanceof Error ? error.message : 'Unauthorized')
  }
  // user.userId, user.email available
}
```

## No CSRF for API Routes

API routes use JWT authentication, not session cookies. Omit csrfToken:

```typescript
const apiSchema = transactionSchema.omit({ csrfToken: true })
```

## Rate Limiting

```typescript
import { checkRateLimit, incrementRateLimit } from '@/lib/rate-limit'

const rateLimit = checkRateLimit(user.userId)
if (!rateLimit.allowed) {
  return rateLimitError(rateLimit.resetAt)
}
incrementRateLimit(user.userId)
```

## Response Helpers

Import from `@/lib/api-helpers`:

```typescript
// Success
return successResponse({ id: created.id }, 201)
return successResponse(data) // 200

// Errors
return validationError({ field: ['Error message'] }) // 400
return authError('Invalid token') // 401
return forbiddenError('No access to account') // 403
return notFoundError('Transaction not found') // 404
return rateLimitError(resetAt) // 429
return serverError('Database error') // 500
```

## Request Pipeline

```typescript
export async function POST(request: NextRequest) {
  // 1. Authenticate with JWT
  // 2. Rate limit check
  // 3. Parse and validate body
  // 4. Authorize (verify resource access)
  // 5. Execute via service layer
  // 6. Return response
}
```

## Input Validation

```typescript
let body
try {
  body = await request.json()
} catch {
  return validationError({ body: ['Invalid JSON'] })
}

const parsed = apiSchema.safeParse(body)
if (!parsed.success) {
  return validationError(parsed.error.flatten().fieldErrors as Record<string, string[]>)
}
```

## Authorization Pattern

```typescript
const account = await prisma.account.findUnique({ where: { id: data.accountId } })
if (!account) {
  return forbiddenError('Account not found')
}

const authUser = await getUserAuthInfo(user.userId)
if (!authUser.accountNames.includes(account.name)) {
  return forbiddenError('You do not have access to this account')
}
```
