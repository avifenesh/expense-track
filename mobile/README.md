# Balance Beacon Mobile

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
  contexts/        # Context tests (AuthContext)
  hooks/           # Hook tests (useAuthState)
  lib/             # Utility tests (validation)
  navigation/      # Navigation component tests (AuthStack, RootNavigator, TabIcon)
  screens/
    auth/          # Auth screen tests (Login, Register, ResetPassword, VerifyEmail)
    onboarding/    # Onboarding screen tests (Welcome, Currency, Categories, Budget, SampleData, Complete)
  services/        # Service tests (api, auth)
```

## Project Structure

```
src/
  components/   # Reusable UI components
  contexts/     # React contexts (AuthContext)
  screens/      # Screen components
    auth/       # Authentication screens (Login, Register, ResetPassword, VerifyEmail)
    onboarding/ # Onboarding flow screens
    main/       # Main app screens (Dashboard, Transactions, etc.)
  hooks/        # Custom React hooks (useAuthState)
  navigation/   # React Navigation setup
    types.ts    # Navigation type definitions
    AuthStack.tsx
    OnboardingStack.tsx
    MainTabNavigator.tsx
    AppStack.tsx
    RootNavigator.tsx
  lib/          # Utilities (validation)
  services/     # API services (api, auth)
  types/        # TypeScript definitions
  constants/    # App constants
```

## Authentication

The app implements JWT-based authentication with the following features:

### Auth Screens

- **LoginScreen** - Email/password login
- **RegisterScreen** - New user registration with email verification
- **VerifyEmailScreen** - Email verification with token
- **ResetPasswordScreen** - Password reset flow

### Auth Services

- `services/auth.ts` - Authentication API client (login, register, password reset, email verification)
- `services/api.ts` - Base API client with JWT token management and request interceptors
- `contexts/AuthContext.tsx` - Authentication state management with React Context

### Auth State

The `AuthContext` provides:
- User authentication state
- Login/logout functionality
- Token refresh handling
- Persistent session storage

### API Integration

All auth endpoints integrate with the backend REST API:
- POST `/api/v1/auth/login` - User login
- POST `/api/v1/auth/register` - User registration
- POST `/api/v1/auth/verify-email` - Verify email with token
- POST `/api/v1/auth/resend-verification` - Resend verification email
- POST `/api/v1/auth/request-reset` - Request password reset
- POST `/api/v1/auth/reset-password` - Reset password with token
- POST `/api/v1/auth/refresh` - Refresh access token
- POST `/api/v1/auth/logout` - Logout and invalidate tokens

See `docs/API_CONTRACTS.md` for full API documentation.

## Navigation Architecture

The app uses React Navigation with conditional routing:

- **AuthStack** - Shown when user is not authenticated
  - Login, Register, ResetPassword, VerifyEmail
- **OnboardingStack** - Shown after login if onboarding not completed
  - Welcome, Currency, Categories, Budget, SampleData, Complete
- **AppStack** - Main app with bottom tabs
  - Dashboard, Transactions, Budgets, Sharing, Settings
