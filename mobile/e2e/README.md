# Mobile E2E Test Suite

Comprehensive end-to-end test suite for Balance Beacon mobile app using Detox.

## Overview

This test suite covers:
- **Authentication** (12 tests): Login, registration, password reset, session management
- **Transactions** (10 tests): Create, edit, delete transactions  
- **Settings** (8 tests): Export data, delete account, sign out
- **Subscription** (6 tests): Paywall flows, subscription loading, expired states

**Total: 36+ mobile E2E tests**

## Architecture

### Contracts-Based Testing

Tests use explicit contracts to define interactions with the app:

1. **UI Contracts** (`contracts/ui-contracts.ts`): Page objects with testIDs, actions, and assertions
2. **API Contracts** (`contracts/api-contracts.ts`): Zod schemas mirroring backend API responses

### Key Components

**UI Contracts:**
- `LoginScreen`, `RegisterScreen`, `ResetPasswordScreen` - Auth flows
- `DashboardScreen`, `TransactionsScreen`, `BudgetsScreen` - Main screens
- `SettingsScreen`, `ExportFormatModal`, `DeleteAccountModal` - Settings
- `PaywallScreen` - Subscription paywall for expired users
- `RootLoadingScreen` - App initialization loading state
- `performLogin()` - Helper for login with subscription loading handling
- `completeOnboarding()` - Helper for onboarding flow

**API Contracts:**
- `LoginResponseContract`, `RegisterResponseContract` - Auth
- `UserProfileContract` - User data with subscription info
- `SubscriptionResponseContract` - Subscription state and checkout info
- `TransactionContract`, `BudgetContract`, `CategoryContract` - Domain models
- `ApiErrorContract` - Standard error responses

### Test Helpers

**TestApiClient** (`helpers/api-client.ts`):
- Direct API calls for test setup and teardown
- `ensureTestUser()` - Creates/logs in test user with subscription verification
- `verifySubscriptionAccess()` - Ensures user has valid subscription
- `setupTestData()` - Seeds categories, transactions, budgets
- `getFirstAccount()`, `getCategoryByName()` - Common queries

**Fixtures** (`helpers/fixtures.ts`):
- `TEST_USER` - Default test user credentials
- `TIMEOUTS` - Consistent timeout values (SHORT: 3s, MEDIUM: 5s, LONG: 15s)

## Setup

### Prerequisites

1. Backend API running at http://localhost:3000 (or configured URL)
2. iOS Simulator or Android Emulator
3. Node.js 20+
4. Detox CLI: `npm install -g detox-cli`

### Build the App

**iOS:**
```bash
cd mobile
npm run build:ios
```

**Android:**
```bash
cd mobile
npm run build:android
```

## Running Tests

### Run all E2E tests

**iOS:**
```bash
cd mobile
npm run test:e2e:ios
```

**Android:**
```bash
cd mobile
npm run test:e2e:android
```

## Test Structure

### Specs

Test files in `mobile/e2e/specs/`:
- `auth.e2e.ts` - Login, registration, password reset
- `transactions.e2e.ts` - Transaction CRUD operations
- `settings.e2e.ts` - Export data, delete account
- `subscription.e2e.ts` - Paywall flows, subscription states

### Subscription Loading Patterns

The app shows a loading screen while fetching subscription status after login. Tests must handle this:

```typescript
// Pattern: Using performLogin helper (recommended)
await performLogin(email, password);
// Automatically handles:
// 1. Login screen interaction
// 2. Wait for login to complete
// 3. Wait for RootLoadingScreen (if it appears)
// 4. Wait for RootLoadingScreen to disappear
// 5. Wait for Dashboard to load
```

## CI/CD

Tests run automatically on:
- Pull requests to main
- Push to main branch
- Scheduled daily runs at 12:00 UTC

### GitHub Actions Workflow

See `.github/workflows/e2e-mobile.yml` for CI configuration.

**Timeouts:**
- iOS: 75 minutes (longer due to simulator startup)
- Android: 45 minutes

## Troubleshooting

### Subscription loading timeout
- Ensure backend subscription API is responding
- Check that test user has valid subscription (created in `ensureTestUser`)

### PaywallScreen appears unexpectedly
- Test user subscription may be expired
- Run `api.verifySubscriptionAccess()` to check subscription state
- Re-run `api.ensureTestUser()` to refresh subscription

### RootLoadingScreen does not appear
- Normal behavior on fast connections or with cached subscription
- Tests should gracefully handle both scenarios (see performLogin pattern)
