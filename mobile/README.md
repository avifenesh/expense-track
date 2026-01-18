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
  components/
    forms/       # Form component tests (FormButton, FormInput, FormSelect, FormCurrencyInput, FormDatePicker)
  contexts/        # Context tests (AuthContext)
  hooks/           # Hook tests (useAuthState)
  lib/             # Utility tests (validation, tokenStorage)
  navigation/      # Navigation component tests (AuthStack, RootNavigator, TabIcon)
  screens/
    auth/          # Auth screen tests (Login, Register, ResetPassword, VerifyEmail)
    onboarding/    # Onboarding screen tests (Welcome, Currency, Categories, Budget, SampleData, Complete)
    main/          # Main app screen tests (Dashboard, Transactions, AddTransaction, Budgets)
  services/        # Service tests (api, auth)
  stores/          # Zustand store tests (auth, accounts, transactions, budgets, categories)
```

## Project Structure

```
src/
  components/   # Reusable UI components
    forms/      # Form components (FormButton, FormInput, FormSelect, FormCurrencyInput, FormDatePicker)
  contexts/     # React contexts (AuthContext)
  screens/      # Screen components
    auth/       # Authentication screens (Login, Register, ResetPassword, VerifyEmail)
    onboarding/ # Onboarding flow screens
    main/       # Main app screens (Dashboard, Transactions, AddTransaction, Budgets)
  hooks/        # Custom React hooks (useAuthState)
  navigation/   # React Navigation setup
    types.ts    # Navigation type definitions
    AuthStack.tsx
    OnboardingStack.tsx
    MainTabNavigator.tsx
    AppStack.tsx
    RootNavigator.tsx
  stores/       # Zustand stores (auth, accounts, transactions, budgets, categories)
  lib/          # Utilities (validation, tokenStorage, logger)
  services/     # API services (api, auth)
  types/        # TypeScript definitions
  constants/    # App constants
```

## UI Components

The mobile app includes reusable UI components for building consistent interfaces. All components follow the dark theme design system with sky blue (#38bdf8) accents.

### BudgetCategoryCard

A card component displaying budget information for a specific category with visual progress indication.

```tsx
import { BudgetCategoryCard } from '@/components';

<BudgetCategoryCard
  categoryName="Food & Dining"
  categoryColor="#4CAF50"
  planned={500}
  spent={350}
  currency="USD"
  onPress={() => console.log('Category tapped')}
/>
```

**Props:**
- `categoryName` - Category display name
- `categoryColor` - Hex color for category indicator dot
- `planned` - Planned budget amount (in major currency units)
- `spent` - Amount spent so far (in major currency units)
- `currency` - Currency code (USD | EUR | ILS)
- `onPress` - Optional press handler (makes card tappable)

**Features:**
- Visual progress bar showing spent vs planned
- Over-budget indication with red color when spent exceeds planned
- Currency-aware formatting
- Accessible with screen reader support
- Optional tap interaction

### Other UI Components

- **MonthSelector** - Month navigation with previous/next controls
- **BudgetProgressCard** - Overall budget summary card
- **EmptyState** - Empty state placeholder with title and message
- **TransactionListItem** - Transaction row with category color
- **DateSectionHeader** - Date section divider for grouped lists


## Form Components

The mobile app includes a comprehensive set of reusable form components for building consistent, accessible forms. All components are fully tested with 90%+ coverage.

### Available Components

#### FormButton
A customizable button component with loading states and multiple variants.

```tsx
import { FormButton } from '@/components/forms';

<FormButton
  title="Submit"
  variant="primary" // primary | secondary | outline | danger
  onPress={handleSubmit}
  isLoading={isSubmitting}
  disabled={!isValid}
/>
```

**Props:**
- `title` - Button text
- `variant` - Style variant (default: 'primary')
- `isLoading` - Shows loading spinner when true
- `disabled` - Disables button interaction
- All standard `PressableProps`

#### FormInput
A text input field with label, error handling, and optional icons.

```tsx
import { FormInput } from '@/components/forms';

<FormInput
  label="Email"
  value={email}
  onChangeText={setEmail}
  error={emailError}
  helperText="We'll never share your email"
  placeholder="you@example.com"
  keyboardType="email-address"
  autoCapitalize="none"
  leftIcon={<EmailIcon />}
  showPasswordToggle={false}
/>
```

**Props:**
- `label` - Input label (required)
- `error` - Error message to display
- `helperText` - Helper text shown below input
- `leftIcon` / `rightIcon` - Optional icon elements
- `showPasswordToggle` - Show/hide toggle for password fields
- All standard `TextInputProps`

#### FormSelect
A dropdown select component with modal picker for mobile.

```tsx
import { FormSelect } from '@/components/forms';

<FormSelect
  label="Category"
  value={selectedCategory}
  onChange={setSelectedCategory}
  options={[
    { value: 'food', label: 'Food & Dining' },
    { value: 'transport', label: 'Transportation' },
    { value: 'shopping', label: 'Shopping', disabled: true },
  ]}
  placeholder="Select a category"
  error={categoryError}
  modalTitle="Choose Category"
/>
```

**Props:**
- `label` - Select label (required)
- `options` - Array of `{ value, label, disabled? }`
- `value` - Currently selected value
- `onChange` - Change handler receiving selected value
- `placeholder` - Text shown when no value selected
- `modalTitle` - Title shown in picker modal

#### FormCurrencyInput
A specialized input for currency amounts with proper decimal handling.

```tsx
import { FormCurrencyInput } from '@/components/forms';

<FormCurrencyInput
  label="Amount"
  currency="USD"  // USD | EUR | ILS
  value={amountInCents}
  onChangeValue={setAmountInCents}
  error={amountError}
  helperText="Enter the transaction amount"
  allowNegative={false}
  maxValue={1000000}  // $10,000 in cents
/>
```

**Props:**
- `label` - Input label (required)
- `currency` - Currency code (USD | EUR | ILS)
- `value` - Amount in cents/minor units
- `onChangeValue` - Change handler receiving cents value
- `allowNegative` - Whether to allow negative values
- `maxValue` / `minValue` - Optional validation bounds (in cents)

**Important:** Values are always stored in cents (minor currency units) for precision.

#### FormDatePicker
A date/time picker using native platform pickers.

```tsx
import { FormDatePicker } from '@/components/forms';

<FormDatePicker
  label="Transaction Date"
  value={selectedDate}
  onChange={setSelectedDate}
  mode="date"  // date | time | datetime
  placeholder="Select a date"
  error={dateError}
  minimumDate={new Date('2020-01-01')}
  maximumDate={new Date()}
  formatOptions={{ dateStyle: 'medium' }}
/>
```

**Props:**
- `label` - Field label (required)
- `value` - Selected date or null
- `onChange` - Change handler receiving Date or null
- `mode` - Picker mode (date, time, or datetime)
- `minimumDate` / `maximumDate` - Date range constraints
- `formatOptions` - Intl.DateTimeFormat options for display

**Dependency:** Requires `@react-native-community/datetimepicker`

### Design System

All form components follow a consistent design system:

- **Color Scheme:** Dark theme with sky blue (#38bdf8) accents
- **Typography:** 14px labels (weight: 600), 16px inputs
- **Spacing:** 16px padding, 12px border radius
- **States:** Focus (blue border), error (red border), disabled (50% opacity)
- **Accessibility:** Proper labels, roles, and states for screen readers

### Testing

All form components have comprehensive test coverage:

```bash
npm test -- FormButton.test.tsx      # Button component tests
npm test -- FormInput.test.tsx       # Text input tests
npm test -- FormSelect.test.tsx      # Select/dropdown tests
npm test -- FormCurrencyInput.test.tsx  # Currency input tests
npm test -- FormDatePicker.test.tsx  # Date picker tests
```

Test coverage includes:
- Rendering with all props
- User interactions (press, text input, selection)
- Validation states (error, focus, disabled)
- Accessibility attributes
- Edge cases (null values, empty options, etc.)

### Example: Complete Form

```tsx
import {
  FormInput,
  FormSelect,
  FormCurrencyInput,
  FormDatePicker,
  FormButton,
} from '@/components/forms';

function TransactionForm() {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = async () => {
    // Validation and submission logic
  };

  return (
    <View style={styles.form}>
      <FormInput
        label="Description"
        value={description}
        onChangeText={setDescription}
        error={errors.description}
        placeholder="Coffee at Starbucks"
      />

      <FormCurrencyInput
        label="Amount"
        currency="USD"
        value={amount}
        onChangeValue={setAmount}
        error={errors.amount}
      />

      <FormSelect
        label="Category"
        value={category}
        onChange={setCategory}
        options={categoryOptions}
        error={errors.category}
      />

      <FormDatePicker
        label="Date"
        value={date}
        onChange={(d) => d && setDate(d)}
        mode="date"
        error={errors.date}
      />

      <FormButton
        title="Save Transaction"
        onPress={handleSubmit}
        variant="primary"
      />
    </View>
  );
}
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
- `lib/tokenStorage.ts` - Secure token storage using expo-secure-store

### Auth State

The `AuthContext` provides:
- User authentication state
- Login/logout functionality
- Token refresh handling
- Persistent session storage via secure platform-native storage

### Secure Token Storage

Tokens are stored securely using `expo-secure-store`, which provides:
- **iOS**: Keychain Services encryption
- **Android**: EncryptedSharedPreferences
- **Web**: LocalStorage fallback (dev only)

Features:
- Automatic token persistence across app restarts
- Secure storage with platform-native encryption
- Automatic session restoration on app launch
- Token refresh on cold start if needed

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
  - **Bottom Tabs**: Dashboard, Transactions, Budgets, Sharing, Settings

## Main App Features

### Transaction Management

Provides views to browse, search, and filter transactions, and to review transaction details as part of the overall budgeting workflow.
