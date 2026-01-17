# Technical Debt

Last updated: 2026-01-17

## Summary

**Total Issues**: 89 | Critical: 10 | High: 24 | Medium: 40 | Low: 15
**Fixed This Session**: 24 issues (6 critical, 10 high, 7 medium, 1 low)

## Critical Issues

### Security

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Unauthenticated cron access if CRON_SECRET unset | src/app/api/cron/subscriptions/route.ts:16 | Require CRON_SECRET always, fail startup if missing | small |
| Committed database credentials | .env.docker, .env.e2e | Remove from git, add to .gitignore, use examples | medium |
| Missing subscription check on API category creation | src/app/api/v1/categories/route.ts | Add hasActiveSubscription check before creation | small |
| Missing subscription check on holdings/recurring API | src/app/api/v1/holdings/route.ts, recurring/route.ts | Add subscription verification | small |

### API Design

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Missing GET endpoints documented in API_CONTRACTS | API_CONTRACTS.md vs implementation | Implement GET /transactions, /budgets, /categories | large |
| REST API doesn't enforce subscription status | All v1 endpoints | Add requireActiveSubscriptionApi() middleware | large |
| Missing pagination despite documentation | All list endpoints | Implement limit/offset pagination | large |

### Database

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Missing cascade delete on Budget FKs | prisma/schema.prisma:89-90 | Add onDelete: Cascade to account/category | small |
| Missing cascade delete on Holding FKs | prisma/schema.prisma:160-161 | Add onDelete: Cascade | small |
| Missing cascade delete on RecurringTemplate FKs | prisma/schema.prisma:182-183 | Add onDelete: Cascade | small |
| Missing cascade delete on Transaction FKs | prisma/schema.prisma:222-224 | Add onDelete: Cascade | small |
| Missing cascade delete on TransactionRequest FKs | prisma/schema.prisma:293-295 | Add onDelete: Cascade | small |

## High Issues

### Security

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Non-blocking security audit in CI | .github/workflows/ci.yml:74-76 | Remove `|| true` | small |
| Hard-coded CI database credentials | .github/workflows/ci.yml:39-41 | Use GitHub Secrets | small |
| Session secret validation lazy | src/lib/auth-server.ts:17-22 | Validate at startup | medium |
| JWT secret validation lazy | src/lib/jwt.ts:16-22 | Validate at startup | medium |
| Email config silent failure in production | src/lib/email.ts:29-43 | Throw if SMTP missing in production | small |
| Race condition in transaction account move | src/app/actions/transactions.ts:306-330 | Use atomic Prisma transaction | medium |
| In-memory rate limiting resets on cold start | src/lib/rate-limit.ts | Document limitation, consider Redis | large |
| Missing secrets rotation documentation | N/A | Create docs/SECRET_ROTATION.md | large |

### Performance

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| N+1 query in getUserAuthInfo per request | src/lib/api-auth.ts:45 | Cache account names in JWT or optimize | medium |
| Unbounded 6-month transaction query | src/lib/finance.ts:462-482 | Add take: 1000 or reduce lookback | small |
| Sequential async currency conversions | src/lib/finance.ts:543-555, 586-598 | Use batchLoadExchangeRates sync pattern | small |

### Architecture

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| God object: finance.ts (1032 lines) | src/lib/finance.ts | Split into domain modules | large |
| Inconsistent auth patterns across actions | src/app/actions/*.ts | Standardize on requireAuthUser() | medium |
| Cross-layer dependency: service imports from actions | src/lib/services/transaction-service.ts:4 | Move toDecimalString to utils | small |
| God object: auth.ts (994 lines) | src/app/actions/auth.ts | Split into auth + account actions | medium |

### Test Quality

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Missing authorization boundary tests | tests/api/v1/transactions.test.ts | Add cross-account access tests | medium |
| Missing account switching security tests | tests/user-isolation.test.ts | Add updateSessionAccount attack tests | medium |
| Missing CSRF validation tests in budget actions | tests/budget-actions.test.ts | Add invalid CSRF token test | small |
| Missing subscription state edge case tests | tests/transaction-crud-actions.test.ts | Add trial/expired/cancelled tests | medium |

### Database

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Soft delete not enforced in getCategories | src/lib/finance.ts:267 | Add isArchived: false filter | small |
| Missing isArchived filter in multiple queries | src/app/actions/auth.ts:438, 676 | Add filter to all category queries | medium |

### API Design

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Inconsistent HTTP status (200 for upsert) | src/app/api/v1/budgets/route.ts:73 | Return 201 for create, 200 for update | small |
| Using 403 for non-existent resources | Multiple API files | Use 404 notFoundError for missing resources | medium |
| Missing rate limit headers | src/lib/api-helpers.ts | Add X-RateLimit-* headers to all responses | medium |
| Inconsistent validation error format | src/app/api/v1/auth/login/route.ts | Use validationError() helper consistently | small |

### Frontend

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Keyboard navigation missing on settings menu | src/components/dashboard/dashboard-page.tsx:341-400 | Add focus trap and arrow key navigation | medium |
| Chat widget stream error handling incomplete | src/components/ai/chat-widget.tsx:244-423 | Add outer try-catch for reader errors | medium |

## Medium Issues

### Security

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Email verification token logged in dev | src/app/api/v1/auth/register/route.ts:74-80 | Remove token from dev logging | small |
| CSRF validation disabled in test env | src/lib/csrf.ts:70-73 | Use VITEST env var instead of NODE_ENV | small |
| Token expiry loose time comparison | src/lib/auth-server.ts:60-62 | Use >= instead of > | small |
| Password reset tokens not cleaned up | src/app/actions/auth.ts:143-201 | Add scheduled cleanup job | medium |
| njsscan workflow suppresses failures | .github/workflows/njsscan.yml:37-38 | Remove `|| true` | small |
| PostgreSQL SSL not enforced | .env.example | Require sslmode=require in production | small |
| Migration shadow DB conflict | .github/workflows/ci.yml:62-66 | Create unique shadow DB per run | medium |
| No cron rate limiting | src/app/api/cron/subscriptions/route.ts | Add rate limit by secret/IP | medium |
| Sentry config not validated at build | next.config.js | Throw if SENTRY_ENABLED but creds missing | small |
| Paddle webhook replay attack possible | src/app/api/webhooks/paddle/route.ts | Add event_id deduplication | medium |

### Performance

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Missing index on TransactionRequest.toId | prisma/schema.prisma:281-296 | Add @@index([toId]) | small |
| failedSymbols Map grows unbounded | src/lib/stock-api.ts:17-35 | Add max size limit and eviction | small |
| Dashboard cache stores large JSON | src/lib/dashboard-cache.ts:88-92 | Add size validation, reject > 512KB | medium |
| Missing pagination on shared expenses | src/lib/finance.ts:768-790, 840-862 | Add take: 50 with cursor pagination | small |
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
| Semantic duplication: filter functions | src/lib/dashboard-ux.ts:9-85 | Abstract to generic predicate filter | low |
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
| Missing index on Budget (accountId, month) | prisma/schema.prisma | Add @@index([accountId, month]) | small |
| Missing index on Transaction date | prisma/schema.prisma:227-228 | Add @@index([date]) | small |
| Missing composite index on ExpenseParticipant | prisma/schema.prisma:265-267 | Add @@index([userId, status]) | small |
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
| Inconsistent request ID validation | Multiple [id] routes | Establish 404 vs 403 pattern | small |
| No error response TypeScript types | src/lib/api-helpers.ts | Export ApiResponse, ValidationError types | small |

### Frontend

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Modal backdrop clickable during submission | src/components/dashboard/share-expense-form.tsx:156-313 | Add pointer-events-none when pending | small |
| CSRF token fetch failure not handled | src/hooks/useCsrfToken.ts | Track loading/error state, show toast | medium |
| Stream reader not cleaned up on unmount | src/components/ai/chat-widget.tsx:322-398 | Call reader.cancel() in cleanup | medium |
| PropDrilling in dashboard tabs | src/components/dashboard/dashboard-page.tsx:561-631 | Create DashboardContext | large |
| Optimistic updates use router.refresh | src/components/dashboard/tabs/transactions-tab.tsx:360-377 | Use rollback() instead | small |
| Modal focus not trapped | src/components/settings/delete-account-dialog.tsx | Add focus trap useEffect | medium |
| Settings menu can overflow viewport | src/components/dashboard/dashboard-page.tsx:341-402 | Add position management | medium |

### DevOps

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| No deployment health check | CI/CD pipeline | Add health endpoint polling after deploy | small |
| Missing centralized env validation | Multiple lib files | Create src/lib/env-schema.ts | medium |

## Low Issues

### Security

| Issue | File | Fix | Effort |
|-------|------|-----|--------|
| Category name validation too loose | src/schemas/index.ts:101 | Add max(100) and content regex | small |
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

## Progress Tracking

### Critical (Must Fix)
- [x] Require CRON_SECRET always (security) - FIXED
- [x] Remove committed .env.docker/.env.e2e (security) - FIXED
- [x] Add subscription checks to API endpoints (security) - FIXED (categories, holdings, recurring)
- [x] Add cascade deletes to all models (database) - FIXED
- [ ] Implement documented GET endpoints (API) - large effort
- [ ] Implement API subscription enforcement (API) - remaining endpoints
- [ ] Implement pagination (API) - large effort

### High Priority (Next Sprint)
- [x] Make security audit blocking (CI) - FIXED
- [x] Make njsscan blocking (CI) - FIXED
- [ ] Move CI credentials to GitHub Secrets (CI)
- [ ] Validate secrets at startup (security)
- [x] Fix email config silent failure (config) - FIXED
- [x] Fix sequential currency conversions (performance) - FIXED
- [x] Move toDecimalString to utils (architecture) - FIXED
- [ ] Split finance.ts (architecture)
- [ ] Add authorization boundary tests (tests)
- [x] Add soft delete filter to category queries (database) - FIXED
- [x] Fix HTTP status codes (API) - FIXED (201 for create, 200 for update; 404 for not found)
- [x] Add query limit to unbounded queries (performance) - FIXED
- [ ] Add keyboard navigation to settings (frontend)

### Medium Priority (Backlog)
- [x] Token expiry loose time comparison (security) - FIXED
- [x] Add new database indexes (database) - FIXED
- [x] Category name validation too loose (security) - FIXED (added max length and alphanumeric boundaries)
- [ ] All other medium issues above
