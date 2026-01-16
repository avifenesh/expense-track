---
paths: ["tests/**"]
---

# Testing Rules

## Coverage Target

90%+ coverage for:
- Server actions
- Schemas
- Services/lib utilities
- Security-critical paths: 100%

## Mock Patterns

Mock at top of file, before imports:

```typescript
vi.mock('@/lib/prisma', () => ({
  prisma: {
    account: { findUnique: vi.fn(), findMany: vi.fn() },
    transaction: { create: vi.fn(), findUnique: vi.fn() },
  }
}))

vi.mock('@/lib/auth-server', () => ({
  requireSession: vi.fn().mockResolvedValue({ userEmail: 'test@example.com' }),
  getDbUserAsAuthUser: vi.fn().mockResolvedValue({ id: 'test-user' }),
}))

vi.mock('@/lib/csrf', () => ({
  validateCsrfToken: vi.fn().mockResolvedValue(true),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

// Import AFTER mocks
import { createTransactionAction } from '@/app/actions'
```

## Test Structure

```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('success cases', () => {
    it('should handle valid input', async () => {
      vi.mocked(prisma.account.findUnique).mockResolvedValueOnce({ ... })

      const result = await someAction({ ... })

      expect('success' in result && result.success).toBe(true)
    })
  })

  describe('error cases', () => {
    it('should return error for invalid input', async () => {
      const result = await someAction({ invalidField: 'bad' })

      expect('error' in result).toBe(true)
    })
  })
})
```

## Required Test Cases

### CSRF Validation
```typescript
it('should validate CSRF token', async () => {
  vi.mocked(validateCsrfToken).mockResolvedValueOnce(false)
  const result = await someAction({ csrfToken: 'invalid' })
  expect('error' in result).toBe(true)
})
```

### Subscription Check
```typescript
it('should check subscription status', async () => {
  vi.mocked(hasActiveSubscription).mockResolvedValueOnce(false)
  const result = await someAction({ ... })
  expect(result.error.subscription).toBeDefined()
})
```

### Account Ownership
```typescript
it('should verify account ownership', async () => {
  vi.mocked(prisma.account.findUnique).mockResolvedValueOnce({
    ...mockAccount,
    userId: 'different-user',
  })
  const result = await someAction({ accountId: 'account-123' })
  expect(result.error.accountId).toContain('do not have access')
})
```

## Security Test Suite

Location: `tests/security/xss.test.ts`

Tests all user input fields against 70+ XSS payloads:
- Transaction descriptions
- Category names
- Budget notes
- URL parameters
- Error messages

Run:
```bash
npm test -- tests/security/xss.test.ts
```

## Running Tests

```bash
npm test                    # All tests
npm test -- tests/security/ # Security tests only
npm test -- --coverage      # With coverage report
```
