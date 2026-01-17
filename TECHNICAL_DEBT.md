# Technical Debt

Last updated: 2026-01-18

## Summary

**Original Issues**: 89 | Critical: 10 | High: 24 | Medium: 40 | Low: 15
**Fixed Total**: 75 issues (10 critical, 19 high, 36 medium, 10 low)
**Remaining**: 14 issues (5 high, 4 medium, 5 low)

## Critical Issues (0 remaining)

All critical issues resolved.

### Blocked (not counted)

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Prisma hono dependency has JWT vulnerabilities | package-lock.json (transitive) | Wait for Prisma fix or downgrade | blocked |

## High Issues (5 remaining)

### Architecture

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| God object: finance.ts (1032 lines) | src/lib/finance.ts | Split into domain modules | large |
| God object: auth.ts (994 lines) | src/app/actions/auth.ts | Split into auth + account actions | medium |

### Test Quality

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Missing authorization boundary tests | tests/api/v1/transactions.test.ts | Add cross-account access tests | medium |
| Missing account switching security tests | tests/user-isolation.test.ts | Add updateSessionAccount attack tests | medium |
| Missing subscription state edge case tests | tests/transaction-crud-actions.test.ts | Add trial/expired/cancelled tests | medium |

## Medium Issues (4 remaining)

### Architecture

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Tight coupling: cache imports finance | src/lib/dashboard-cache.ts:4-5 | Generify cache to accept compute function | medium |

### Test Quality

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Rate limit isolation not verified | tests/api/v1/auth-login-rate-limit.test.ts:70-90 | Assert rate limit counter per email | small |

### API Design

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Generic error messages mask real issues | src/app/api/v1/categories/route.ts:50-51 | Distinguish error types in catch | medium |
| Missing GET parameter validation | src/app/api/v1/budgets/route.ts:96-106 | Add explicit null checks | small |

## Low Issues (5 remaining)

### Architecture

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Circular dependency risk in cache | src/lib/dashboard-cache.ts | Keep as thin wrapper, no re-exports | small |
| No boundary between public/private types | src/lib/finance.ts:14-198 | Add @private JSDoc or barrel exports | small |
| Action CSRF patterns inconsistent | Multiple action files | Ensure all use same pipeline | small |

### Test Quality

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| SQL injection test missing for user lookup | tests/expense-sharing-actions.test.ts | Add email injection payload test | small |

### Database

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| No audit trail for deletions | prisma/schema.prisma | DEFERRED - Requires full soft delete impl across all queries | large |
