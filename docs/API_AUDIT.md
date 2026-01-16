# API Audit Report for Mobile Compatibility

This document provides a complete inventory of server actions and REST API endpoints, identifying mobile-incompatible patterns and gaps in API coverage for mobile app development.

## Executive Summary

- **Total Server Actions**: 41
- **Total REST Endpoints**: 17
- **Overall Coverage**: ~41%
- **Fully Covered Domains**: 5 (Transactions, Budgets, Categories, Holdings, Recurring)
- **Domains Missing Coverage**: 4 (Auth completion, Expense Sharing, Onboarding, Misc)

## Server Actions Inventory

### Auth Actions (`src/app/actions/auth.ts`)

| Function | Purpose | Parameters | Mobile Issues |
|----------|---------|------------|---------------|
| `loginAction` | Authenticate user | `{ email, password }` | Cookie session, CSRF rotation |
| `logoutAction` | Clear session | None | Cookie session |
| `registerAction` | Register new user | `{ email, password, displayName }` | None (stateless) |
| `verifyEmailAction` | Verify email token | `{ token }` | None (stateless) |
| `resendVerificationEmailAction` | Resend verification | `{ email }` | None (stateless) |
| `requestPasswordResetAction` | Request password reset | `{ email }` | None (stateless) |
| `resetPasswordAction` | Reset password | `{ token, newPassword }` | None (stateless) |
| `deleteAccountAction` | Delete user (GDPR) | `{ csrfToken, confirmEmail }` | CSRF, cookie session |
| `exportUserDataAction` | Export user data (GDPR) | `{ csrfToken, format }` | CSRF |
| `persistActiveAccountAction` | Switch active account | `{ csrfToken, accountId }` | CSRF, cookie session |

### Transaction Actions (`src/app/actions/transactions.ts`)

| Function | Purpose | Parameters | Mobile Issues |
|----------|---------|------------|---------------|
| `createTransactionAction` | Create transaction | `TransactionInput` | CSRF, `revalidatePath` |
| `updateTransactionAction` | Update transaction | `TransactionUpdateInput` | CSRF, `revalidatePath` |
| `deleteTransactionAction` | Delete transaction | `{ id, csrfToken }` | CSRF, `revalidatePath` |
| `createTransactionRequestAction` | Create request between accounts | `TransactionRequestInput` | CSRF, `revalidatePath` |
| `approveTransactionRequestAction` | Approve request | `{ id, csrfToken }` | CSRF, `revalidatePath` |
| `rejectTransactionRequestAction` | Reject request | `{ id, csrfToken }` | CSRF, `revalidatePath` |

### Budget Actions (`src/app/actions/budgets.ts`)

| Function | Purpose | Parameters | Mobile Issues |
|----------|---------|------------|---------------|
| `upsertBudgetAction` | Create/update budget | `BudgetInput` | CSRF, `revalidatePath` |
| `deleteBudgetAction` | Delete budget | `{ csrfToken, accountId, categoryId, monthKey }` | CSRF, `revalidatePath` |

### Category Actions (`src/app/actions/categories.ts`)

| Function | Purpose | Parameters | Mobile Issues |
|----------|---------|------------|---------------|
| `createCategoryAction` | Create category | `{ csrfToken, name, type, color? }` | CSRF, `revalidatePath`, `requireSession` |
| `archiveCategoryAction` | Archive/unarchive | `{ csrfToken, id, isArchived }` | CSRF, `revalidatePath`, `requireSession` |

### Holdings Actions (`src/app/actions/holdings.ts`)

| Function | Purpose | Parameters | Mobile Issues |
|----------|---------|------------|---------------|
| `createHoldingAction` | Create holding | `HoldingInput` | CSRF, `revalidatePath` |
| `updateHoldingAction` | Update holding | `{ csrfToken, id, quantity, averageCost, notes? }` | CSRF, `revalidatePath` |
| `deleteHoldingAction` | Delete holding | `{ csrfToken, id }` | CSRF, `revalidatePath` |
| `refreshHoldingPricesAction` | Refresh stock prices | `{ csrfToken, accountId }` | CSRF, `revalidatePath` |

### Recurring Actions (`src/app/actions/recurring.ts`)

| Function | Purpose | Parameters | Mobile Issues |
|----------|---------|------------|---------------|
| `upsertRecurringTemplateAction` | Create/update template | `RecurringTemplateInput` | CSRF, `revalidatePath` |
| `toggleRecurringTemplateAction` | Toggle active status | `{ csrfToken, id, isActive }` | CSRF, `revalidatePath` |
| `applyRecurringTemplatesAction` | Apply templates to month | `{ csrfToken, monthKey, accountId, templateIds? }` | CSRF, `revalidatePath` |

### Expense Sharing Actions (`src/app/actions/expense-sharing.ts`)

| Function | Purpose | Parameters | Mobile Issues |
|----------|---------|------------|---------------|
| `shareExpenseAction` | Share expense with users | `ShareExpenseInput` | CSRF, `revalidatePath` |
| `markSharePaidAction` | Mark share as paid | `{ csrfToken, participantId }` | CSRF, `revalidatePath` |
| `cancelSharedExpenseAction` | Cancel shared expense | `{ csrfToken, sharedExpenseId }` | CSRF, `revalidatePath` |
| `declineShareAction` | Decline share | `{ csrfToken, participantId }` | CSRF, `revalidatePath` |
| `getMySharedExpensesAction` | Get shared expenses | None | None (read-only) |
| `getExpensesSharedWithMeAction` | Get expenses shared with me | None | None (read-only) |
| `lookupUserForSharingAction` | Lookup user by email | `{ csrfToken, email }` | CSRF |
| `sendPaymentReminderAction` | Send payment reminder | `{ csrfToken, participantId }` | CSRF, `revalidatePath` |

### Onboarding Actions (`src/app/actions/onboarding.ts`)

| Function | Purpose | Parameters | Mobile Issues |
|----------|---------|------------|---------------|
| `completeOnboardingAction` | Mark onboarding complete | `{ csrfToken }` | CSRF, `revalidatePath`, `requireSession` |
| `skipOnboardingAction` | Skip onboarding | `{ csrfToken }` | CSRF, `revalidatePath`, `requireSession` |
| `updatePreferredCurrencyAction` | Update currency preference | `{ csrfToken, currency }` | CSRF, `revalidatePath`, `requireSession` |
| `createInitialCategoriesAction` | Create initial categories | `{ csrfToken, categories }` | CSRF, `revalidatePath`, `requireSession` |
| `createQuickBudgetAction` | Create quick budget | `{ csrfToken, accountId, categoryId, monthKey, planned, currency }` | CSRF, `revalidatePath`, `requireSession` |
| `seedSampleDataAction` | Seed sample data | `{ csrfToken }` | CSRF, `revalidatePath`, `requireSession` |

### Misc Actions (`src/app/actions/misc.ts`)

| Function | Purpose | Parameters | Mobile Issues |
|----------|---------|------------|---------------|
| `refreshExchangeRatesAction` | Refresh exchange rates | `{ csrfToken }` | CSRF, `revalidatePath`, `requireSession` |
| `setBalanceAction` | Set account balance | `{ csrfToken, accountId, targetBalance, currency, monthKey }` | CSRF, `revalidatePath` |

## REST API Endpoints Inventory

### Auth Endpoints (`/api/v1/auth/`)

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/v1/auth/login` | POST | Authenticate user | None |
| `/api/v1/auth/logout` | POST | Invalidate refresh token | Refresh Token |
| `/api/v1/auth/refresh` | POST | Refresh access token | Refresh Token |

### Transaction Endpoints (`/api/v1/transactions/`)

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/v1/transactions` | POST | Create transaction | JWT Bearer |
| `/api/v1/transactions/[id]` | GET | Get transaction | JWT Bearer |
| `/api/v1/transactions/[id]` | PUT | Update transaction | JWT Bearer |
| `/api/v1/transactions/[id]` | DELETE | Delete transaction | JWT Bearer |
| `/api/v1/transactions/requests` | GET | Get requests | JWT Bearer |
| `/api/v1/transactions/requests` | POST | Create request | JWT Bearer |
| `/api/v1/transactions/requests/[id]/approve` | POST | Approve request | JWT Bearer |
| `/api/v1/transactions/requests/[id]/reject` | POST | Reject request | JWT Bearer |

### Budget Endpoints (`/api/v1/budgets/`)

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/v1/budgets` | POST | Upsert budget | JWT Bearer |
| `/api/v1/budgets` | DELETE | Delete budget | JWT Bearer |

### Category Endpoints (`/api/v1/categories/`)

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/v1/categories` | POST | Create category | JWT Bearer |
| `/api/v1/categories/[id]/archive` | PATCH | Archive category | JWT Bearer |

### Holdings Endpoints (`/api/v1/holdings/`)

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/v1/holdings` | POST | Create holding | JWT Bearer |
| `/api/v1/holdings/[id]` | GET | Get holding | JWT Bearer |
| `/api/v1/holdings/[id]` | PUT | Update holding | JWT Bearer |
| `/api/v1/holdings/[id]` | DELETE | Delete holding | JWT Bearer |
| `/api/v1/holdings/refresh` | POST | Refresh prices | JWT Bearer |

### Recurring Endpoints (`/api/v1/recurring/`)

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/api/v1/recurring` | POST | Upsert template | JWT Bearer |
| `/api/v1/recurring/[id]/toggle` | PATCH | Toggle active | JWT Bearer |
| `/api/v1/recurring/apply` | POST | Apply templates | JWT Bearer |

## Mobile-Incompatible Patterns

### 1. CSRF Token Validation

**Pattern**: `requireCsrfToken(data.csrfToken)`

**Location**: All mutating server actions

**Issue**: CSRF protection is designed for browser-based attacks where cookies are automatically sent. Mobile apps use Bearer tokens in headers, making CSRF irrelevant.

**Solution**: REST API omits CSRF validation and uses JWT Bearer authentication instead.

### 2. Cookie-Based Session Authentication

**Pattern**: `requireSession()`, `establishSession()`, `clearSession()`, `updateSessionAccount()`

**Location**: `auth.ts`, `categories.ts`, `misc.ts`, `onboarding.ts`

**Issue**: Server actions use Next.js `cookies()` API which requires browser context. Mobile cannot use HTTP-only cookies in the same way.

**Solution**: REST API uses `requireJwtAuth()` with Bearer token in Authorization header.

### 3. Cache Revalidation

**Pattern**: `revalidatePath('/')`

**Location**: End of all mutating server actions

**Issue**: This is a Next.js server component cache invalidation mechanism. It only affects web app rendering.

**Solution**: Mobile apps manage their own cache (React Query, SWR, or manual). REST API does not call `revalidatePath`.

### 4. Server Redirects

**Pattern**: `redirect('/path')`

**Location**: Some auth flows

**Issue**: Server-side redirects are web-specific. Mobile apps handle navigation locally.

**Solution**: REST API returns success/error responses; mobile handles navigation.

## Coverage Matrix

| Domain | Server Actions | REST Endpoints | Coverage | Priority |
|--------|---------------|----------------|----------|----------|
| Auth (Core) | 3 | 3 | 100% | - |
| Auth (Registration) | 4 | 0 | 0% | Critical |
| Auth (GDPR) | 2 | 0 | 0% | Critical |
| Transactions | 6 | 8 | 100% | - |
| Budgets | 2 | 2 | 100% | - |
| Categories | 2 | 2 | 100% | - |
| Holdings | 4 | 5 | 100% | - |
| Recurring | 3 | 3 | 100% | - |
| Expense Sharing | 8 | 0 | 0% | High |
| Onboarding | 6 | 0 | 0% | Medium |
| Misc | 2 | 0 | 0% | Low |

## Gap Analysis: Missing REST Endpoints

### Critical Priority (Auth)

These endpoints are required for basic mobile app functionality:

```
POST   /api/v1/auth/register           - User registration
POST   /api/v1/auth/verify-email       - Email verification
POST   /api/v1/auth/resend-verification - Resend verification email
POST   /api/v1/auth/request-reset      - Request password reset
POST   /api/v1/auth/reset-password     - Reset password with token
DELETE /api/v1/auth/account            - Delete account (GDPR)
GET    /api/v1/auth/export             - Export user data (GDPR)
```

### High Priority (Expense Sharing)

Core feature for the app:

```
POST   /api/v1/expenses/share              - Share expense with users
PATCH  /api/v1/expenses/shares/[id]/paid   - Mark share as paid
DELETE /api/v1/expenses/shares/[id]        - Cancel shared expense
POST   /api/v1/expenses/shares/[id]/decline - Decline share
GET    /api/v1/expenses/shared-by-me       - Get my shared expenses
GET    /api/v1/expenses/shared-with-me     - Get expenses shared with me
GET    /api/v1/users/lookup                - Lookup user by email
POST   /api/v1/expenses/shares/[id]/remind - Send payment reminder
```

### Medium Priority (Read Endpoints)

Mobile needs list endpoints for data sync:

```
GET    /api/v1/transactions       - List transactions (with filters)
GET    /api/v1/budgets            - List budgets for account/month
GET    /api/v1/categories         - List user categories
GET    /api/v1/holdings           - List holdings for account
GET    /api/v1/recurring          - List recurring templates
GET    /api/v1/accounts           - List user accounts
GET    /api/v1/dashboard          - Dashboard summary data
GET    /api/v1/users/me           - Current user profile
```

### Medium Priority (Onboarding)

Support mobile onboarding flow:

```
POST   /api/v1/onboarding/complete     - Mark onboarding complete
POST   /api/v1/onboarding/skip         - Skip onboarding
PATCH  /api/v1/users/me/currency       - Update preferred currency
POST   /api/v1/categories/bulk         - Bulk create categories
POST   /api/v1/budgets/quick           - Quick budget creation
POST   /api/v1/seed-data               - Seed sample data
```

### Low Priority (Misc)

```
POST   /api/v1/exchange-rates/refresh   - Refresh exchange rates
POST   /api/v1/accounts/[id]/set-balance - Set account balance
PATCH  /api/v1/accounts/[id]/activate   - Switch active account
```

## Critical Issue: Subscription Validation

**Finding**: REST API endpoints do not enforce subscription status.

Server actions use:
- `requireActiveSubscription()` - Checks subscription is active
- `ensureAccountAccessWithSubscription()` - Combined access + subscription check

REST API only uses:
- `requireJwtAuth()` - JWT validation
- `ensureApiAccountOwnership()` - Account ownership check

**Recommendation**: Add subscription validation middleware to REST API before mobile launch:

```typescript
// Add to src/app/api/v1/lib/auth.ts
export async function requireActiveApiSubscription(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId }
  });

  if (!subscription || subscription.status !== 'ACTIVE') {
    throw new ApiError(403, 'Active subscription required');
  }
}
```

## Recommendations

### Phase 1: Auth Endpoints (Before Mobile Launch)
1. Add registration endpoint
2. Add email verification endpoints
3. Add password reset endpoints
4. Add GDPR endpoints (delete, export)

### Phase 2: Read Endpoints (Before Mobile Launch)
1. Add list endpoints for all resources
2. Add dashboard summary endpoint
3. Add user profile endpoint

### Phase 3: Expense Sharing (Core Feature)
1. Add all expense sharing endpoints
2. This is a primary mobile use case

### Phase 4: Onboarding (Nice to Have)
1. Add onboarding endpoints
2. Mobile can use web onboarding initially

### Phase 5: Subscription Middleware (Critical)
1. Add subscription validation to REST API
2. Ensure feature parity with server actions
