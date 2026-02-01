# Mobile E2E Tests

End-to-end tests for the Balance Beacon mobile app using Detox and Jest.

## Architecture

The E2E test suite uses a **contracts-based architecture** with three layers:

1. **UI Contracts** (`contracts/ui-contracts.ts`) - Page objects with testIDs and actions
2. **API Contracts** (`contracts/api-contracts.ts`) - Zod schemas for API validation
3. **Test Helpers** (`helpers/`) - TestApiClient, fixtures, and utilities

## Key Components

### UI Contracts

Page objects for all screens with testIDs and helper methods:

### TestID Pattern for TransactionListItem

To ensure reliable E2E test targeting, `TransactionListItem` components must include a `testID` prop:

```typescript
// TransactionListItem component accepts an optional testID prop
interface TransactionListItemProps {
  transaction: Transaction
  onPress?: (transaction: Transaction) => void
  testID?: string  // For E2E test targeting
}

// Usage in parent components (e.g., DashboardScreen)
<TransactionListItem
  transaction={transaction}
  onPress={handleTransactionPress}
  testID={`dashboard.transaction.${transaction.id}`}  // Unique identifier
/>
```

**Key Points:**

- Always provide unique `testID` values based on transaction IDs
- Use consistent naming pattern: `transaction-{id}`
- This enables reliable element selection in E2E tests via `by.id()`

## Timeout Configuration

E2E tests use configurable timeouts defined in `helpers/fixtures.ts`:

```typescript
export const TIMEOUTS = {
  SHORT: 5000, // Quick operations (5 seconds)
  MEDIUM: 10000, // Standard operations (10 seconds)
  LONG: 60000, // Complex operations like login (60 seconds)
  STARTUP: 120000, // App/CI startup (120 seconds)
}
```

**Timeout Guidelines:**

- `SHORT`: Element visibility checks, simple interactions
- `MEDIUM`: Form submissions, navigation transitions
- `LONG`: Initial app load, login flows, API-dependent operations
- `STARTUP`: CI environment startup, backend initialization

When writing tests, always use these constants rather than hardcoded values:

```typescript
await waitFor(element(by.id('login.screen')))
  .toBeVisible()
  .withTimeout(TIMEOUTS.LONG)
```

## Error Handling and Logging

The E2E test suite includes comprehensive error handling for better debugging:

### performLogin Error Handling

The `performLogin` helper captures screenshots on failure:

```typescript
export async function performLogin(email: string, password: string): Promise<void> {
  try {
    await LoginScreen.waitForScreen()
    await LoginScreen.login(email, password)
    await waitFor(element(by.id('login.screen')))
      .not.toBeVisible()
      .withTimeout(TIMEOUTS.LONG)
    // Wait for subscription initialization and dashboard
    await waitFor(element(by.id('dashboard.screen')))
      .toBeVisible()
      .withTimeout(TIMEOUTS.LONG)
  } catch (error) {
    console.error('[performLogin] Login failed:', error)
    await device.takeScreenshot('login-failure')
    throw new Error(`Login failed for ${email}: ${error instanceof Error ? error.message : String(error)}`)
  }
}
```

### Backend Manager Logging

The `BackendManager` class captures startup logs for debugging:

```typescript
class BackendManager {
  private startupLog: string = ''

  async start(): Promise<void> {
    // Captures stdout/stderr during startup
    this.process.stdout?.on('data', (data) => {
      this.startupLog += data.toString()
    })
  }
}
```

When tests fail, the startup log is automatically included in error messages.

## Key Components

### UI Contracts

Page objects for all screens with testIDs and helper methods:

- `LoginScreen`, `RegisterScreen`, `ResetPasswordScreen`
- `DashboardScreen`, `TransactionsScreen`, `BudgetsScreen`, `SettingsScreen`
- `PaywallScreen` - Subscription expiration flow
- `RootLoadingScreen` - App initialization loading state
- `performLogin()` helper - Handles login with subscription loading wait

### API Contracts

Zod schemas matching API responses:

- `LoginRequestContract`, `LoginResponseContract`
- `TransactionContract`, `CreateTransactionRequestContract`
- `SubscriptionResponseContract` - GET /api/v1/subscriptions

### TestApiClient

Helper class for test setup:

- `ensureTestUser()` - Creates/verifies test user with subscription
- `getSubscriptionStatus()` - Verifies user has active subscription
- `verifySubscriptionAccess()` - Validates `canAccessApp` is true
- `setupTestData()` - Seeds categories and test transactions

## Subscription Loading Pattern

After the PaywallScreen was added, the app waits for subscription initialization before showing the dashboard. E2E tests must handle this:

```typescript
// In performLogin helper (ui-contracts.ts)
await LoginScreen.tapLogin()
await waitFor(element(by.id('login.screen')))
  .not.toBeVisible()
  .withTimeout(TIMEOUTS.LONG)

// Wait for subscription loading (may not appear on fast connections)
try {
  await waitFor(element(by.id('root.loadingScreen')))
    .toBeVisible()
    .withTimeout(TIMEOUTS.SHORT)
  await RootLoadingScreen.waitForDisappear()
} catch {
  // Loading screen may not appear on fast connections or cached subscription
}

// Finally verify dashboard
await waitFor(element(by.id('dashboard.screen')))
  .toBeVisible()
  .withTimeout(TIMEOUTS.LONG)
```

## Running Tests

```bash
# iOS
cd mobile
npm run e2e:build:ios
npm run e2e:test:ios

# Android
npm run e2e:build:android
npm run e2e:test:android

# Release builds (used in CI)
npm run e2e:build:ios:release
npm run e2e:test:ios:release
```

## CI Configuration

E2E tests run on:

- **Schedule**: Daily at 00:00 and 12:00 UTC
- **Pull Requests**: When mobile/e2e/\*\* files change
- **Manual**: workflow_dispatch

Timeouts:

- **iOS**: 45 minutes (tests take ~25min)
- **Android**: 45 minutes (tests take ~32min)

## Troubleshooting

### Tests timeout waiting for dashboard

The app waits for subscription initialization after login. Ensure:

1. Test users have valid TRIALING subscriptions (created by seed-e2e.ts)
2. Backend `/api/v1/subscriptions` endpoint is responding
3. `performLogin` helper includes subscription loading wait

### App crashes with "Maximum update depth exceeded"

This indicates an infinite render loop. Check:

1. Zustand hooks use individual selectors (not returning new objects)
2. No circular dependencies in store subscriptions
3. useAuthState and useSubscriptionState patterns are followed

### Backend not responding

Check that:

1. Backend server started successfully (health check logs)
2. DATABASE_URL is correct for the platform
3. Test database seeded with users (AUTH_USER1_HASH, AUTH_USER2_HASH)
