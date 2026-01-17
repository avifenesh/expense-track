# Technical Debt

Last updated: 2026-01-18

## Summary

**Original Issues**: 89 | Critical: 10 | High: 24 | Medium: 40 | Low: 15
**Fixed Total**: 69 issues (10 critical, 19 high, 33 medium, 7 low)
**Remaining**: 20 issues (5 high, 7 medium, 8 low)

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

## Medium Issues (7 remaining)

### Architecture

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Tight coupling: cache imports finance | src/lib/dashboard-cache.ts:4-5 | Generify cache to accept compute function | medium |
| Inconsistent data validation strategy | Services vs Actions vs API | Add validation at service layer boundary | medium |
| Inconsistent error handling between layers | Services vs Actions | Standardize error handling at service layer | medium |

### Test Quality

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Rate limit isolation not verified | tests/api/v1/auth-login-rate-limit.test.ts:70-90 | Assert rate limit counter per email | small |

### API Design

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Generic error messages mask real issues | src/app/api/v1/categories/route.ts:50-51 | Distinguish error types in catch | medium |
| Missing GET parameter validation | src/app/api/v1/budgets/route.ts:96-106 | Add explicit null checks | small |

### DevOps

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Missing centralized env validation | Multiple lib files | Create src/lib/env-schema.ts | medium |

## Low Issues (8 remaining)

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

### Test Quality

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| SQL injection test missing for user lookup | tests/expense-sharing-actions.test.ts | Add email injection payload test | small |

### Database

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Decimal precision inconsistency | Multiple files | Document quantity vs amount precision | small |
| SharedExpense index ordering | prisma/schema.prisma:246-247 | Add @@index([ownerId, createdAt]) | small |
| No audit trail for deletions | prisma/schema.prisma | Consider soft delete on Transaction, Budget | large |

---

## Fixed This Session (81 issues)

### Critical (10 fixed)
- [x] Require CRON_SECRET always (security)
- [x] Remove committed .env.docker/.env.e2e (security)
- [x] Add subscription checks to API endpoints (categories, holdings, recurring)
- [x] Add cascade deletes to all 5 models (database)
- [x] Implement GET endpoints for /transactions, /budgets, /categories (PR #169)
- [x] Add subscription enforcement to all mutating API routes (PR #169)
- [x] Implement limit/offset pagination on list endpoints (PR #169)
- [x] Hard-coded CI database credentials → GitHub Secrets (PR #170)

### High (19 fixed)
- [x] Keyboard navigation on settings menu → focus trap + arrow keys (PR #171)
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
- [x] In-memory rate limiting documented with limitations (PR #170)
- [x] Missing secrets rotation documentation → docs/SECRET_ROTATION.md (PR #170)
- [x] N+1 query in getUserAuthInfo → consolidated auth checks (PR #178)
- [x] Inconsistent auth patterns across actions → standardized on ensureAccountAccessWithSubscription (PR #178)

### Medium (37 fixed)
- [x] Modal backdrop clickable during submission → pointer-events-none (PR #171)
- [x] CSRF token fetch failure → loading/error state with toast (PR #171)
- [x] PropDrilling in dashboard tabs → DashboardContext (PR #171)
- [x] Modal focus not trapped → focus trap useEffect (PR #171)
- [x] Settings menu viewport overflow → position management (PR #171)
- [x] Settings menu re-adds event listener → useCallback stable handler (PR #171)
- [x] Holdings tab refetches on currency change → remove preferredCurrency dep (PR #176)
- [x] Optimistic updates use router.refresh → rollback() instead (PR #176)
- [x] Token expiry loose time comparison (>= instead of >)
- [x] Add new database indexes (4 indexes)
- [x] Category name validation (max length + alphanumeric boundaries)
- [x] Email verification token removed from dev logging
- [x] CSRF validation uses VITEST env var (not NODE_ENV)
- [x] failedSymbols Map size limit (max 1000 with cleanup)
- [x] Chat widget stream reader cleanup on unmount
- [x] PostgreSQL SSL not enforced → documented in .env.example (PR #170)
- [x] Migration shadow DB conflict → unique shadow DB per run (PR #170)
- [x] Sentry config not validated at build → throws if enabled without DSN (PR #170)
- [x] No cron rate limiting → added IP-based rate limiting (PR #174)
- [x] Paddle webhook replay attack → event_id deduplication (PR #174)
- [x] Password reset tokens not cleaned up → /api/cron/cleanup endpoint (PR #174)
- [x] Duplicated access control logic → generic ensureResourceOwnership helper (PR #175)
- [x] Missing API auth middleware → withApiAuth centralized middleware (PR #175)
- [x] No database-level date validation → CHECK constraint endMonth >= startMonth (PR #175)
- [x] Category unique constraint race condition → atomic reactivate with updateMany (PR #175)
- [x] CSRF token in all schemas → separate API schemas without CSRF (PR #175)
- [x] No error response TypeScript types → ApiResponse, ApiErrorResponse exports (PR #175)
- [x] Inconsistent authorization patterns → standardized withApiAuth middleware (PR #175)
- [x] Auth module session/user separation → validateSessionToken() + getDbUserBasic() (PR #178)
- [x] Repeated account lookups in API routes → centralized ensureApiAccountOwnership helper (PR #180)
- [x] API response format not validated → full response schema assertions in tests (PR #180)
- [x] Inconsistent response data format → mutations return full resources per API_CONTRACTS (PR #180)
- [x] No deployment health check → verify-deployment CI job with retry logic (PR #180)

### Low (10 fixed)
- [x] Holdings delete button loading state → deletingId tracking (PR #176)
- [x] Transaction form empty state → message instead of skeleton (PR #176)
- [x] useOptimisticList unmount cleanup → mounted ref (PR #176)
- [x] Tab panel aria-controls → ARIA attributes on all panels (PR #176)
- [x] Refresh button animate-spin → cn() with conditional class (PR #176)
- [x] Token expiry comparison boundary
- [x] Display name regex allows "- - -" → require alphanumeric start/end (PR #174)
- [x] Test secrets committed in workflow → moved to GitHub Secrets (PR #170)
- [x] Decimal precision not tested → added 0.1+0.2 precision tests (PR #177)
- [x] Missing documentation comments → JSDoc added to all API route handlers (PR #180)

### Test Quality - Agent 2 (6 fixed in PRs #172, #177)
- [x] Missing CSRF validation tests in budget actions → added CSRF token tests (PR #172)
- [x] Expense sharing calculations not validated → added math verification tests (PR #177)
- [x] Budget service Decimal mock inconsistent → unified MockDecimal with toFixed (PR #177)
- [x] Dashboard cache invalidation not asserted → added invalidateDashboardCache assertions (PR #177)
- [x] Concurrent transaction modification untested → added P2025 race condition tests (PR #177)

### Finance/Cache - Agent 3 (6 fixed in PR #179)
- [x] Dashboard cache stores large JSON → added 512KB size validation with skip-on-oversized (PR #179)
- [x] Missing pagination on shared expenses → cursor-based pagination with 50 record default (PR #179)
- [x] FX rates use today's date → per-month rate loading for historical accuracy (PR #179)
- [x] Semantic duplication: filter functions → generic createFilter predicate utility (PR #179)
- [x] Flaky date-dependent tests → vi.setSystemTime() with fixed test date (PR #179)
- [x] Null field handling not asserted → objectContaining assertions for null preservation (PR #179)
