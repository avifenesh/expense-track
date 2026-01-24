# Mobile E2E Testing with Detox

End-to-end tests for the Balance Beacon mobile app using [Detox](https://wix.github.io/Detox/).

## Prerequisites

### Backend
- Docker (for PostgreSQL)
- Node.js 20+

### Android (Windows/Linux/macOS)
- Android Studio with:
  - Android SDK
  - Android Emulator
  - API Level 31 (Android 12) system image with Google APIs
- Java 17 (Temurin recommended)
- Environment variables:
  ```
  ANDROID_HOME=<sdk-path>
  JAVA_HOME=<jdk-path>
  ```
- Emulator named `test_avd` (or update `detox.config.js`)

### iOS (macOS only)
- Xcode 16.2+
- iOS Simulator (iPhone 15)
- applesimutils: `brew tap wix/brew && brew install applesimutils`
- CocoaPods: `brew install cocoapods`

## Local Setup (Windows/Android)

### 1. Start Backend Services

From the project root:

```bash
# Start PostgreSQL
docker compose up -d

# Install dependencies and set up database
npm install
npm run db:push

# Seed E2E test users (required for tests)
npm run db:seed:e2e
```

Create `.env` with:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/expense_track
JWT_SECRET=e2e-test-secret-key-for-jwt-signing
JWT_REFRESH_SECRET=e2e-test-refresh-secret-key
AUTH_SESSION_SECRET=e2e-test-session-secret-at-least-32-chars
NEXTAUTH_SECRET=e2e-test-nextauth-secret
APP_URL=https://e2e-test.local:3000
```

Start the backend:
```bash
npm run dev
```

### 2. Set Up Mobile App

From the `mobile/` directory:

```bash
npm install --legacy-peer-deps
npm install -g detox-cli
```

Create `mobile/.env`:
```
# Android emulator uses 10.0.2.2 to reach host
EXPO_PUBLIC_API_URL=http://10.0.2.2:3000/api/v1
```

### 3. Build Native App

Generate Android project and build release APK:

```bash
# Generate native code
npx expo prebuild --clean --platform android

# Build release APK for Detox (includes bundled JS)
npm run e2e:build:android:release
```

### 4. Start Android Emulator

Using Android Studio or command line:

```bash
# List available AVDs
emulator -list-avds

# Start emulator (use your AVD name)
emulator -avd test_avd
```

### 5. Run E2E Tests

```bash
# Run all tests (release configuration - recommended for Windows)
npm run e2e:test:android:release

# Run specific test file
npx detox test -c android.emu.release e2e/specs/smoke.e2e.ts

# Run with verbose logging
npm run e2e:test:android:release -- --loglevel trace
```

## Test Structure

```
mobile/e2e/
  contracts/
    ui-contracts.ts   # Page objects with testIDs and actions
  helpers/
    api-client.ts     # Direct API calls for test setup/teardown
    fixtures.ts       # Test constants and timeouts
  specs/
    smoke.e2e.ts      # Basic app launch tests
    auth.e2e.ts       # Authentication flow tests
    transactions.e2e.ts  # Transaction CRUD tests
    budgets.e2e.ts    # Budget management tests
  globalSetup.ts      # Runs before all tests
```

## Test API Client

The `TestApiClient` class (`helpers/api-client.ts`) provides methods for:
- `register(email, password, name)` - Register new test user
- `login(email, password)` - Login and get tokens
- `seedData()` - Seed categories and sample transactions
- `getAccounts()` - Get user's accounts
- `ensureTestUser()` - Register/login and seed data if needed

## Test Users

E2E tests use special `@test.local` email addresses which:
- Skip email verification
- Automatically get accounts and trial subscriptions
- Are isolated from production data

Default test credentials (from `db:seed:e2e`):
- Email: `e2e-user1@test.local`
- Password: `password123`

## Troubleshooting

### "No account found" / 403 Errors

Test users need accounts and subscriptions. The `completeOnboarding` API endpoint automatically creates these for `@test.local` users. If you see 403 errors:

1. Ensure you've run `npm run db:seed:e2e`
2. Try calling the completeOnboarding endpoint to fix existing users

### Submit Button Not Found After Typing

The keyboard can cover the submit button. The test contracts now:
1. Call `tapReturnKey()` after password entry to dismiss keyboard
2. Scroll while waiting for the submit button to become visible

### Metro Bundle Not Loading (Blank Screen) - Windows

On Windows with debug builds, there's a known issue with chunked transfer encoding between Metro and the Android emulator.

**Solution**: Use release builds instead of debug builds for E2E testing on Windows:
```bash
npm run e2e:build:android:release
npm run e2e:test:android:release
```

Release builds bundle the JS inside the APK, eliminating Metro dependency.

### Emulator Not Detected

```bash
# Check connected devices
adb devices -l

# If empty, restart ADB
adb kill-server
adb start-server

# Cold boot emulator if needed (from Android Studio AVD Manager)
```

### Build Failures

```bash
# Clean and rebuild
cd mobile
rm -rf android/
npx expo prebuild --clean --platform android
npm run e2e:build:android:release
```

### Test Timeouts

Default timeout is 120 seconds. If tests timeout:
1. Check backend is running and healthy
2. Verify emulator has internet access
3. Check if the API responds: `curl http://localhost:3000/api/v1/users/me`

## CI Configuration

The GitHub Actions workflow (`.github/workflows/e2e-mobile.yml`) runs:
- **iOS E2E Tests**: On macOS-14 runner with iPhone 15 simulator
- **Android E2E Tests**: On Ubuntu with API 31 x86_64 emulator

Tests run:
- Daily at 00:00 and 12:00 UTC (schedule)
- On PRs to main that modify `mobile/e2e/**`
- Manual trigger via workflow_dispatch

## Available Scripts

```bash
# iOS (macOS only)
npm run e2e:build:ios:release    # Build release app
npm run e2e:test:ios:release     # Run tests (release)

# Android
npm run e2e:build:android:release # Build release APK
npm run e2e:test:android:release # Run tests (release)
npm run e2e:build:android        # Build debug APK
npm run e2e:test:android         # Run tests (debug)
```

## Writing Tests

```typescript
import { device, element, by, expect } from 'detox';
import { LoginScreen, DashboardScreen } from '../contracts/ui-contracts';

describe('Feature Tests', () => {
  beforeEach(async () => {
    await device.launchApp({ newInstance: true });
    await LoginScreen.waitForScreen();
    await LoginScreen.login('test@test.local', 'password123');
    await DashboardScreen.waitForScreen();
  });

  it('should show dashboard', async () => {
    await expect(element(by.id('dashboard.screen'))).toBeVisible();
  });
});
```

## Best Practices

1. **Use UI Contracts**: Use the page objects in `contracts/ui-contracts.ts` for consistent element access
2. **Test isolation**: Each test should be independent. Use `beforeEach` to reset state
3. **Use testIDs**: Always add `testID` props to components for reliable selection
4. **Wait for elements**: Use `waitFor` for async operations
5. **API setup**: Use `TestApiClient` for data setup, not UI interactions
6. **Screenshots on failure**: Artifacts are uploaded on CI failure for debugging
