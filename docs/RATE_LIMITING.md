# Rate Limiting

This document describes the rate limiting implementation in Balance Beacon.

## Overview

Rate limiting protects the application from abuse, brute force attacks, and excessive resource consumption. The implementation uses an in-memory sliding window algorithm.

## Implementation

**File**: `src/lib/rate-limit.ts`

### Algorithm

The rate limiter uses a sliding window approach:
1. Each identifier (IP, email, user ID) has an entry with a count and reset time
2. Requests increment the counter until the limit is reached
3. After the window expires, the counter resets

### Rate Limit Types

| Type | Window | Max Requests | Purpose |
|------|--------|--------------|---------|
| `default` | 1 minute | 100 | General API rate limiting |
| `login` | 1 minute | 5 | Brute force protection |
| `registration` | 1 minute | 3 | Spam prevention |
| `password_reset` | 1 hour | 3 | Abuse prevention |
| `resend_verification` | 15 minutes | 3 | Email spam prevention |
| `account_deletion` | 1 hour | 3 | Accidental deletion prevention |
| `data_export` | 1 hour | 3 | GDPR export rate limiting |
| `ai_chat` | 1 minute | 20 | AI API cost management |

### Usage

```typescript
import { checkRateLimitTyped, incrementRateLimitTyped } from '@/lib/rate-limit'

// Check rate limit before processing
const result = checkRateLimitTyped(userEmail, 'login')
if (!result.allowed) {
  return Response.json({ error: 'Too many requests' }, { status: 429 })
}

// Process request...

// Increment counter after processing (success or failure)
incrementRateLimitTyped(userEmail, 'login')
```

### Response Headers

Include rate limit headers for client visibility:

```typescript
import { getRateLimitHeaders } from '@/lib/rate-limit'

const headers = getRateLimitHeaders(userId, 'default')
// Returns: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
```

## Known Limitations

### Cold Start Reset

In serverless environments (Vercel, AWS Lambda, etc.), the in-memory store resets when:
- A new deployment occurs
- The function cold starts after inactivity
- The instance is recycled

**Impact**: Rate limit counters are lost, allowing requests to proceed even if the previous limit was reached.

**Risk Level**: Medium - affects brute force protection on auth endpoints.

### Multi-Instance Inconsistency

When running multiple server instances (horizontal scaling):
- Each instance maintains its own in-memory store
- Effective limit = `maxRequests × numberOfInstances`
- Load balancing may distribute an attacker's requests across instances

**Impact**: Rate limiting is less effective under load-balanced deployments.

## Production Recommendations

For production deployments with strict rate limiting requirements:

### Option 1: Redis-backed Rate Limiting (Recommended)

```typescript
// Example using @upstash/ratelimit
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
})
```

**Pros**: Consistent across instances, persists through cold starts
**Cons**: Additional infrastructure cost, network latency

### Option 2: Vercel Edge Middleware with KV

```typescript
// middleware.ts
import { kv } from '@vercel/kv'

export async function middleware(request: NextRequest) {
  const ip = request.ip ?? '127.0.0.1'
  const count = await kv.incr(`ratelimit:${ip}`)
  // ...
}
```

**Pros**: Edge execution, low latency, Vercel-native
**Cons**: Vercel-specific, KV storage costs

### Option 3: Cloudflare Rate Limiting

Configure rate limiting at the edge via Cloudflare dashboard or API.

**Pros**: No code changes, handles DDoS, global edge
**Cons**: Requires Cloudflare, configuration complexity

### Option 4: Database-backed for Critical Endpoints

Store rate limit counters in the database for critical endpoints like password reset.

**Pros**: Persistent, works with existing infrastructure
**Cons**: Database load, higher latency

## Current Status

The current in-memory implementation is acceptable for:
- Development and staging environments
- Single-instance deployments
- Low-traffic applications

Before scaling to production with multiple instances, implement one of the recommendations above.

## Testing

Reset all rate limits for testing:

```typescript
import { resetAllRateLimits } from '@/lib/rate-limit'

beforeEach(() => {
  resetAllRateLimits()
})
```

Test rate limit behavior:

```typescript
import { checkRateLimitTyped, incrementRateLimitTyped } from '@/lib/rate-limit'

it('should block after max requests', () => {
  const identifier = 'test@example.com'

  for (let i = 0; i < 5; i++) {
    const result = checkRateLimitTyped(identifier, 'login')
    expect(result.allowed).toBe(true)
    incrementRateLimitTyped(identifier, 'login')
  }

  const blocked = checkRateLimitTyped(identifier, 'login')
  expect(blocked.allowed).toBe(false)
})
```
