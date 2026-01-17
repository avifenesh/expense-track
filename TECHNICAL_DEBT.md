# Technical Debt

Last updated: 2026-01-17

## Summary

**Original Issues**: 89 | Critical: 10 | High: 24 | Medium: 40 | Low: 15
**Fixed This Session**: 35 issues (9 critical, 14 high, 11 medium, 1 low)
**Remaining**: 54 issues (1 critical, 10 high, 29 medium, 14 low)

## Critical Issues (1 remaining)

### Security

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Hard-coded CI database credentials | .github/workflows/ci.yml:39-41 | Use GitHub Secrets | small |

### Blocked (not counted)

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Prisma hono dependency has JWT vulnerabilities | package-lock.json (transitive) | Wait for Prisma fix or downgrade | blocked |

## High Issues (10 remaining)

### Security

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| In-memory rate limiting resets on cold start | src/lib/rate-limit.ts | Document limitation, consider Redis | large |
| Missing secrets rotation documentation | N/A | Create docs/SECRET_ROTATION.md | large |

### Performance

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| N+1 query in getUserAuthInfo per request | src/lib/api-auth.ts:45 | Cache account names in JWT or optimize | medium |

### Architecture

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| God object: finance.ts (1032 lines) | src/lib/finance.ts | Split into domain modules | large |
| Inconsistent auth patterns across actions | src/app/actions/*.ts | Standardize on requireAuthUser() | medium |
| God object: auth.ts (994 lines) | src/app/actions/auth.ts | Split into auth + account actions | medium |

### Test Quality

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Missing authorization boundary tests | tests/api/v1/transactions.test.ts | Add cross-account access tests | medium |
| Missing account switching security tests | tests/user-isolation.test.ts | Add updateSessionAccount attack tests | medium |
| Missing CSRF validation tests in budget actions | tests/budget-actions.test.ts | Add invalid CSRF token test | small |
| Missing subscription state edge case tests | tests/transaction-crud-actions.test.ts | Add trial/expired/cancelled tests | medium |

### Frontend

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Keyboard navigation missing on settings menu | src/components/dashboard/dashboard-page.tsx:341-400 | Add focus trap and arrow key navigation | medium |

## Medium Issues (29 remaining)

### Security

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Password reset tokens not cleaned up | src/app/actions/auth.ts:143-201 | Add scheduled cleanup job | medium |
| PostgreSQL SSL not enforced | .env.example | Require sslmode=require in production | small |
| Migration shadow DB conflict | .github/workflows/ci.yml:62-66 | Create unique shadow DB per run | medium |
| No cron rate limiting | src/app/api/cron/subscriptions/route.ts | Add rate limit by secret/IP | medium |
| Sentry config not validated at build | next.config.js | Throw if SENTRY_ENABLED but creds missing | small |
| Paddle webhook replay attack possible | src/app/api/webhooks/paddle/route.ts | Add event_id deduplication | medium |

### Performance

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Dashboard cache stores large JSON | src/lib/dashboard-cache.ts:88-92 | Add size validation, reject > 512KB | medium |
| Missing pagination on shared expenses | src/lib/finance.ts:768-790, 840-862 | Add take: 50 with cursor pagination | small |
| FX rates use today's date for historical conversions | src/lib/finance.ts:548-552 | Load per-month rates for historical accuracy | medium |
| Repeated account lookups in API routes | Multiple API files | Create checkAccountAccess() utility | medium |
| React settings menu re-adds event listener | src/components/dashboard/dashboard-page.tsx:193-203 | Use useCallback for stable handler | small |
| Holdings tab refetches on currency change | src/components/dashboard/holdings-tab.tsx:54-97 | Remove preferredCurrency from loadHoldings deps | small |

### Architecture

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Duplicated access control logic | src/lib/api-auth-helpers.ts:18-88 | Create generic ensureResourceOwnership | small |
| Tight coupling: cache imports finance | src/lib/dashboard-cache.ts:4-5 | Generify cache to accept compute function | medium |
| Missing abstraction: repeated API auth | Multiple API routes | Extract requireApiResourceAccess middleware | small |
| Inconsistent data validation strategy | Services vs Actions vs API | Add validation at service layer boundary | medium |
| Auth module handles session AND user | src/lib/auth-server.ts | Consider separating session vs user lookup | medium |
| Inconsistent error handling between layers | Services vs Actions | Standardize error handling at service layer | medium |

### Test Quality

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Rate limit isolation not verified | tests/api/v1/auth-login-rate-limit.test.ts:70-90 | Assert rate limit counter per email | small |
| Expense sharing calculations not validated | tests/expense-sharing-actions.test.ts:113-144 | Add math verification tests | medium |
| Budget service Decimal mock inconsistent | tests/lib/services/budget-service.test.ts:65-71 | Unify MockDecimal implementation | small |
| Dashboard cache invalidation not asserted | tests/transaction-crud-actions.test.ts:130-145 | Add invalidateDashboardCache assertions | small |
| Concurrent transaction modification untested | tests/transaction-crud-actions.test.ts | Add findUnique success + update fail test | medium |
| API response format not validated | tests/api/v1/transactions.test.ts:92-98 | Verify against API_CONTRACTS schema | medium |
| Flaky date-dependent tests | tests/transaction-crud-actions.test.ts:136 | Use vi.setSystemTime() | small |

### Database

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| No database-level date validation | prisma/schema.prisma:178-179 | Add CHECK constraint for endMonth >= startMonth | medium |
| Category unique constraint race condition | src/app/actions/categories.ts:36 | Use upsert with isArchived: false | medium |

### API Design

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Generic error messages mask real issues | src/app/api/v1/categories/route.ts:50-51 | Distinguish error types in catch | medium |
| Inconsistent response data format | Multiple endpoints | Return full resource on mutations | medium |
| Inconsistent authorization patterns | Multiple API routes | Standardize on helper function | medium |
| CSRF token in all schemas | src/schemas/index.ts | Create separate API schemas | small |
| Missing GET parameter validation | src/app/api/v1/budgets/route.ts:96-106 | Add explicit null checks | small |
| No error response TypeScript types | src/lib/api-helpers.ts | Export ApiResponse, ValidationError types | small |

### Frontend

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Modal backdrop clickable during submission | src/components/dashboard/share-expense-form.tsx:156-313 | Add pointer-events-none when pending | small |
| CSRF token fetch failure not handled | src/hooks/useCsrfToken.ts | Track loading/error state, show toast | medium |
| PropDrilling in dashboard tabs | src/components/dashboard/dashboard-page.tsx:561-631 | Create DashboardContext | large |
| Optimistic updates use router.refresh | src/components/dashboard/tabs/transactions-tab.tsx:360-377 | Use rollback() instead | small |
| Modal focus not trapped | src/components/settings/delete-account-dialog.tsx | Add focus trap useEffect | medium |
| Settings menu can overflow viewport | src/components/dashboard/dashboard-page.tsx:341-402 | Add position management | medium |

### DevOps

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| No deployment health check | CI/CD pipeline | Add health endpoint polling after deploy | small |
| Missing centralized env validation | Multiple lib files | Create src/lib/env-schema.ts | medium |

## Low Issues (14 remaining)

### Security

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Display name regex allows "- - -" | src/app/api/v1/auth/register/route.ts:23 | Require alphanumeric at start/end | small |
| Test secrets committed in workflow | .github/workflows/ci.yml:85-94 | Move to GitHub Secrets | small |

### Performance

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| RefreshToken index could be composite | prisma/schema.prisma:308-310 | Add @@index([expiresAt, userId]) | small |

### Architecture

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Circular dependency risk in cache | src/lib/dashboard-cache.ts | Keep as thin wrapper, no re-exports | small |
| No boundary between public/private types | src/lib/finance.ts:14-198 | Add @private JSDoc or barrel exports | small |
| Action CSRF patterns inconsistent | Multiple action files | Ensure all use same pipeline | small |
| Semantic duplication: filter functions | src/lib/dashboard-ux.ts:9-85 | Abstract to generic predicate filter | low |

### Test Quality

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Null field handling not fully asserted | tests/transaction-crud-actions.test.ts:206-243 | Add objectContaining assertions | small |
| Decimal precision not tested | tests/finance.test.ts | Add 0.1 + 0.2 precision test | small |
| SQL injection test missing for user lookup | tests/expense-sharing-actions.test.ts | Add email injection payload test | small |

### Database

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Decimal precision inconsistency | Multiple files | Document quantity vs amount precision | small |
| SharedExpense index ordering | prisma/schema.prisma:246-247 | Add @@index([ownerId, createdAt]) | small |
| No audit trail for deletions | prisma/schema.prisma | Consider soft delete on Transaction, Budget | large |

### API Design

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Missing documentation comments | All route.ts files | Add JSDoc to all handlers | small |

### Frontend

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Holdings delete button no loading state | src/components/dashboard/holdings-tab.tsx:138-155 | Pass disabled={isPendingAction} | small |
| No loading skeleton for transaction form | src/components/dashboard/tabs/transactions-tab.tsx:407-609 | Add isLoading placeholder | small |
| useOptimisticList no unmount cleanup | src/hooks/useOptimisticList.ts | Track mounted ref | small |
| Tab panel missing aria-controls | src/components/dashboard/tabs/transactions-tab.tsx:402 | Add aria-controls to tab buttons | small |
| Refresh button icon doesn't animate | src/components/dashboard/dashboard-page.tsx:526-547 | Add animate-spin when pending | small |

---

## Fixed This Session (35 issues)

### Critical (9 fixed)
- [x] Require CRON_SECRET always (security)
- [x] Remove committed .env.docker/.env.e2e (security)
- [x] Add subscription checks to API endpoints (categories, holdings, recurring)
- [x] Add cascade deletes to all 5 models (database)
- [x] Implement GET endpoints for /transactions, /budgets, /categories (PR #169)
- [x] Add subscription enforcement to all mutating API routes (PR #169)
- [x] Implement limit/offset pagination on list endpoints (PR #169)

### High (14 fixed)
- [x] Make security audit blocking (CI)
- [x] Make njsscan blocking (CI)
- [x] Validate secrets at startup - JWT_SECRET at module load
- [x] Fix email config silent failure in production
- [x] Fix sequential currency conversions (batch pattern)
- [x] Move toDecimalString to utils (architecture)
- [x] Add soft delete filter to category queries
- [x] Fix HTTP status codes (201 for create, 200 for update)
- [x] Use 404 for non-existent resources (not 403)
- [x] Add query limit to unbounded queries (take: 1000)
- [x] Fix race condition in transaction update (atomic Prisma transaction)
- [x] Add rate limit headers helper (successResponseWithRateLimit)
- [x] Standardize validation error format (login uses validationError())

### Medium (11 fixed)
- [x] Token expiry loose time comparison (>= instead of >)
- [x] Add new database indexes (4 indexes)
- [x] Category name validation (max length + alphanumeric boundaries)
- [x] Email verification token removed from dev logging
- [x] CSRF validation uses VITEST env var (not NODE_ENV)
- [x] failedSymbols Map size limit (max 1000 with cleanup)
- [x] Chat widget stream reader cleanup on unmount

### Low (1 fixed)
- [x] Token expiry comparison boundary
