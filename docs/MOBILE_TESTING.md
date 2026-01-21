# Mobile Testing Guide

## Unit Tests

Tests use Jest and React Native Testing Library. Current coverage: 90.9%

### Running Tests

```bash
cd mobile
npm test                    # Run all tests
npm test -- --coverage      # Run with coverage report
npm test -- --watch         # Run in watch mode
npm test -- LoginScreen     # Run specific test file
```

### Test Structure

```
mobile/__tests__/
  components/
    forms/       # Form component tests
  contexts/      # Context tests (AuthContext)
  hooks/         # Hook tests (useAuthState)
  lib/           # Utility tests (validation, tokenStorage)
  navigation/    # Navigation component tests
  screens/
    auth/        # Auth screen tests
    onboarding/  # Onboarding screen tests
    main/        # Main app screen tests
  services/      # Service tests (api, auth)
  stores/        # Zustand store tests
```

## E2E Tests

End-to-end tests use Detox to validate complete user workflows on iOS and Android.

### Prerequisites

- **iOS (macOS only)**: Xcode 16.2+ with command-line tools
- **Android (all platforms)**: Android SDK with API 31 system image

### Quick Start

#### First-Time Setup

```bash
cd mobile
npm run e2e:setup
```

This will:
- Auto-detect your platform (macOS, Linux, Windows)
- Install Detox CLI globally
- Install required platform tools (applesimutils for iOS, Android SDK components)
- Create iOS simulator (iPhone 15) if needed
- Create Android AVD (named "test", API 31) if needed
- Run `expo prebuild` to generate native projects
- Install npm dependencies

#### Running Tests

**Full workflow (setup + run + teardown)**:
```bash
npm run e2e:full:ios       # iOS only
npm run e2e:full:android   # Android only
npm run e2e:full:both      # Both platforms
```

**Run tests only (assumes setup already done)**:
```bash
npm run e2e:run:ios        # iOS only
npm run e2e:run:android    # Android only
npm run e2e:run:both       # Both platforms
```

**Advanced options (use scripts directly)**:
```bash
# Run specific test file
./scripts/run-e2e.sh --platform ios --spec e2e/specs/auth.e2e.ts

# Build before testing
./scripts/run-e2e.sh --platform android --build

# Use release build
./scripts/run-e2e.sh --platform ios --release --build

# Run without headless mode (show simulator/emulator)
./scripts/run-e2e.sh --platform android --no-headless
```

#### Teardown

```bash
npm run e2e:teardown       # Kill emulators/simulators and clean up
```

### E2E Test Suites

Tests are organized by feature area (50 total tests - P0 + P1):

- **auth.e2e.ts** - Login, registration, password reset, biometric auth (8 tests)
- **onboarding.e2e.ts** - Multi-step onboarding wizard, budget setup, biometric enablement (4 tests)
- **transactions.e2e.ts** - Transaction list, filtering, search (5 tests)
- **budgets.e2e.ts** - Budget display, month navigation, budget creation (6 tests)
- **sharing.e2e.ts** - Expense sharing, balance summary, create/settle expenses (7 tests)
- **navigation.e2e.ts** - Tab navigation, state persistence, back navigation (5 tests)
- **settings.e2e.ts** - Settings menu, logout, profile editing, biometric toggle (8 tests)
- **errors.e2e.ts** - Error handling, network failures, offline indicator (7 tests)

### Platform-Specific Notes

**macOS**:
- Supports both iOS and Android testing
- iOS requires Xcode (macOS only)
- Use Homebrew to install applesimutils: `brew install applesimutils`

**Linux**:
- Android testing only
- Requires KVM for hardware acceleration: `sudo apt-get install qemu-kvm`
- Set up permissions: Add user to `kvm` group

**Windows**:
- Android testing only
- Use PowerShell scripts directly: `.\scripts\setup-e2e.ps1`
- Or use Git Bash with `.sh` scripts

### Manual Setup (Alternative)

If automated setup fails, you can set up manually:

**iOS Simulator**:
```bash
xcrun simctl create "iPhone 15" "com.apple.CoreSimulator.SimDeviceType.iPhone-15"
```

**Android AVD**:
```bash
sdkmanager "system-images;android-31;google_apis;x86_64"
avdmanager create avd -n test -k "system-images;android-31;google_apis;x86_64" -d "pixel_5"
```

### Troubleshooting

**iOS simulator won't boot**:
- Try: `killall Simulator && xcrun simctl erase all`
- Restart Xcode

**Android emulator won't boot**:
- Try: `adb kill-server && adb start-server`
- Delete and recreate AVD: `avdmanager delete avd -n test`

**Tests failing**:
- Check artifacts in `mobile/artifacts/` for screenshots and logs
- Run with `--no-headless` to watch execution
- Ensure device is booted: `xcrun simctl list` (iOS) or `adb devices` (Android)

### Test Artifacts

Failed tests automatically save:
- Screenshots (before/after each step)
- Device logs
- UI hierarchy dumps

Location: `mobile/artifacts/`

### CI Integration

E2E tests run automatically in GitHub Actions on PRs. See `.github/workflows/e2e-mobile.yml` for CI configuration.

## Automation Scripts

The mobile E2E testing infrastructure includes cross-platform automation scripts:

### Setup Scripts

**Bash (macOS/Linux/Git Bash):**
```bash
cd mobile
./scripts/setup-e2e.sh
```

**PowerShell (Windows native):**
```powershell
cd mobile
.\scripts\setup-e2e.ps1
```

### Run Scripts

**Bash:**
```bash
./scripts/run-e2e.sh --platform ios
./scripts/run-e2e.sh --platform android --build
./scripts/run-e2e.sh --platform ios --spec e2e/specs/auth.e2e.ts
```

**PowerShell:**
```powershell
.\scripts\run-e2e.ps1 --platform android
```

### All-in-One Workflow

```bash
./scripts/e2e.sh --platform ios          # Full iOS E2E workflow
./scripts/e2e.sh --platform android --release  # Android with release build
./scripts/e2e.sh --platform ios --skip-setup   # Skip setup (devices already configured)
```

### Script Features

- Auto-detects platform (macOS, Linux, Windows)
- Auto-installs dependencies (Detox CLI, applesimutils, Android SDK components)
- Auto-creates devices (iPhone 15 simulator, Android AVD "test")
- Manages emulator/simulator lifecycle (boot, wait-for-ready, test, shutdown)
- Supports both platforms or individual selection
- Collects test artifacts automatically

## Writing E2E Tests

### TestID Naming Convention

**Pattern**: `{screenName}.{elementName}` (lowercase, dot-separated)

**Examples**:
- Screen containers: `onboarding.welcome.screen`, `transactions.screen`
- Buttons: `onboarding.welcome.getStartedButton`, `transactions.addButton`
- Inputs: `onboarding.budget.amountInput`
- Lists: `transactions.list`, `budgets.categoryList`
- States: `transactions.emptyState`, `budgets.loadingIndicator`, `sharing.errorState`

### Adding TestIDs to Components

```tsx
<SafeAreaView style={styles.container} testID="transactions.screen">
  <Text style={styles.title} testID="transactions.title">Transactions</Text>
  <Pressable testID="transactions.addButton" onPress={handleAdd}>
    <Text>Add</Text>
  </Pressable>
  <FlatList testID="transactions.list" data={transactions} />
</SafeAreaView>
```

### Test Helpers

**Authentication:**
```typescript
import { loginAsPrimaryUser, completeOnboarding, logout } from '../helpers';

await loginAsPrimaryUser();
await completeOnboarding();
await logout();
```

**Biometric Mocking:**
```typescript
import { BiometricHelpers } from '../helpers';

await BiometricHelpers.enableForPlatform();
await BiometricHelpers.authenticateSuccess();
await BiometricHelpers.authenticateFailure();
```

**Network Simulation:**
```typescript
import { simulateOffline, simulateOnline, NetworkHelpers } from '../helpers';

await simulateOffline();
// Test offline behavior
await simulateOnline();

// Or use wrapper for automatic cleanup
await NetworkHelpers.withOfflineMode(async () => {
  // Test offline behavior
  // Network will be restored automatically
});
```

### Example Test

```typescript
import { element, by, expect, waitFor, device } from 'detox';
import { loginAsPrimaryUser, completeOnboarding } from '../helpers';

describe('Transactions', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await loginAsPrimaryUser();
    await completeOnboarding();

    // Navigate to transactions
    await element(by.id('tab.transactions')).tap();
    await waitFor(element(by.id('transactions.screen')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should display transaction list', async () => {
    await expect(element(by.id('transactions.screen'))).toBeVisible();
    await expect(element(by.id('transactions.title'))).toBeVisible();
    await expect(element(by.id('transactions.addButton'))).toBeVisible();
  });

  it('should filter by type', async () => {
    await element(by.id('transactions.filterIncome')).tap();
    await expect(element(by.id('transactions.screen'))).toBeVisible();

    await element(by.id('transactions.filterExpense')).tap();
    await expect(element(by.id('transactions.screen'))).toBeVisible();
  });
});
```
