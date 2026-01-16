# Expense Track Mobile

React Native mobile app built with Expo.

## Prerequisites

- Node.js LTS
- iOS: Xcode (macOS only)
- Android: Android Studio with emulator

## Getting Started

```bash
npm install
npm start
```

## Scripts

- `npm start` - Start Expo dev server
- `npm run ios` - Run on iOS simulator
- `npm run android` - Run on Android emulator
- `npm run lint` - Run ESLint
- `npm run check-types` - TypeScript check
- `npm test` - Run tests
- `npm test -- --coverage` - Run tests with coverage report

## Testing

Tests are written with Jest and React Native Testing Library. Current coverage: 90.9%

### Running Tests

```bash
npm test                    # Run all tests
npm test -- --coverage      # Run with coverage report
npm test -- --watch         # Run in watch mode
npm test -- LoginScreen     # Run specific test file
```

### Test Structure

```
__tests__/
  hooks/           # Hook tests (useAuthState)
  navigation/      # Navigation component tests (TabIcon)
  screens/
    auth/          # Auth screen tests (Login, Register, ResetPassword, VerifyEmail)
    onboarding/    # Onboarding screen tests (Welcome, Currency, Categories, Budget, SampleData, Complete)
```

## Project Structure

```
src/
  components/   # Reusable UI components
  screens/      # Screen components
    auth/       # Authentication screens (Login, Register, etc.)
    onboarding/ # Onboarding flow screens
    main/       # Main app screens (Dashboard, Transactions, etc.)
  hooks/        # Custom React hooks
  navigation/   # React Navigation setup
    types.ts    # Navigation type definitions
    AuthStack.tsx
    OnboardingStack.tsx
    MainTabNavigator.tsx
    AppStack.tsx
    RootNavigator.tsx
  lib/          # Utilities and services
  types/        # TypeScript definitions
  constants/    # App constants
```

## Navigation Architecture

The app uses React Navigation with conditional routing:

- **AuthStack** - Shown when user is not authenticated
  - Login, Register, ResetPassword, VerifyEmail
- **OnboardingStack** - Shown after login if onboarding not completed
  - Welcome, Currency, Categories, Budget, SampleData, Complete
- **AppStack** - Main app with bottom tabs
  - Dashboard, Transactions, Budgets, Sharing, Settings
