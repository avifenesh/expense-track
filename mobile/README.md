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
    main/          # Main app screen tests (Dashboard, Transactions, AddTransaction, EditTransaction, Budgets, AddBudget)
  services/        # Service tests (api, auth)
  stores/          # Zustand store tests (auth, accounts, transactions, budgets, categories, sharing)
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
    main/       # Main app screens (Dashboard, Transactions, AddTransaction, EditTransaction, Budgets, AddBudget)
  hooks/        # Custom React hooks (useAuthState)
  navigation/   # React Navigation setup
    types.ts    # Navigation type definitions
    AuthStack.tsx
    OnboardingStack.tsx
    MainTabNavigator.tsx
    AppStack.tsx
    RootNavigator.tsx
  stores/       # Zustand stores (auth, accounts, transactions, budgets, categories, sharing)
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

### MonthSelector

A month navigation component with arrow controls and modal picker for selecting months.

```tsx
import { MonthSelector } from '@/components';

<MonthSelector
  selectedMonth="2026-01"
  onMonthChange={(month) => console.log('Selected:', month)}
  minMonth="2025-01"
  maxMonth="2026-12"
  allowFutureMonths={false}
  yearRange={5}
  testID="dashboard-month-selector"
/>
```

**Props:**
- `selectedMonth` - Currently selected month in YYYY-MM format (required)
- `onMonthChange` - Callback when month changes, receives new month in YYYY-MM format (required)
- `disabled` - Disable all interactions (default: false)
- `minMonth` - Minimum selectable month in YYYY-MM format (optional)
- `maxMonth` - Maximum selectable month in YYYY-MM format (default: current month)
- `allowFutureMonths` - Allow selection of future months, removes default max restriction (default: false)
- `yearRange` - Number of years to show in the modal picker (default: 5)
- `testID` - Test ID for testing library queries (optional)

**Features:**
- Previous/next arrow buttons for month navigation
- Tap on month label opens modal picker
- Modal with year selector and month grid (4 columns x 3 rows)
- Disabled state for navigation buttons at min/max boundaries
- Disabled months in grid for out-of-bounds selections
- Full accessibility support with proper labels, roles, and states

### Other UI Components

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
- **AppStack** - Main app with bottom tabs and modals
  - **Bottom Tabs**: Dashboard, Transactions, Budgets, Sharing, Settings
  - **Modals**: CreateTransaction (AddTransactionScreen), CreateBudget (AddBudgetScreen)
  - **Screens**: EditTransaction (EditTransactionScreen)

## Main App Features

### Transaction Management

#### AddTransactionScreen

Modal screen for creating new transactions with comprehensive form:

**Features:**
- Transaction type selector (Income/Expense) with visual feedback
- Amount input with currency symbol display (USD: $, EUR: €, ILS: ₪)
- Category selector with color-coded chips (filtered by transaction type)
- Date selector with quick options:
  - Today
  - Yesterday
  - Custom date picker (last 7 days)
- Optional description field (max 200 characters)
- Real-time form validation
- Transaction preview before submission
- Loading states and error handling

**Access:**
- FAB (Floating Action Button) on Dashboard screen
- `+ Add` button on Transactions screen

**Navigation:**
- Presented as modal with slide-from-bottom animation
- Cancel button returns to previous screen
- Auto-dismisses on successful creation

**Validation:**
- Amount: Required, positive, max 2 decimals, max value 999,999,999.99
- Description: Optional, max 200 chars, XSS prevention
- Category: Required
- Date: Required, not in future, within 10 years

**Integration:**
- Uses `POST /api/v1/transactions` endpoint
- Syncs with transactions store on success
- Updates dashboard and transaction list automatically

#### EditTransactionScreen

Screen for editing and deleting existing transactions:

**Features:**
- Pre-populated form with existing transaction data
- Transaction type toggle (Income/Expense) with visual feedback
- Amount editing with currency symbol display (USD: $, EUR: €, ILS: ₪)
- Category selector with color-coded chips (filtered by transaction type)
- Date selector with quick options:
  - Today
  - Yesterday
  - Custom date picker (last 7 days)
- Optional description field (max 200 characters)
- Real-time form validation
- Transaction preview showing updated values
- Delete transaction functionality with confirmation dialog
- Loading states and error handling
- Transaction not found state handling

**Access:**
- Tap on any transaction from TransactionsScreen or DashboardScreen

**Navigation:**
- Opens as a full screen within AppStack
- Cancel button returns to previous screen
- Auto-dismisses on successful update or deletion

**Validation:**
- Amount: Required, positive, max 2 decimals, max value 999,999,999.99
- Description: Optional, max 200 chars, XSS prevention
- Category: Required
- Date: Required, not in future, within 10 years

**Integration:**
- Uses `PUT /api/v1/transactions/[id]` endpoint for updates
- Uses `DELETE /api/v1/transactions/[id]` endpoint for deletion
- Syncs with transactions store on success
- Updates dashboard and transaction list automatically

**User Experience:**
- Confirmation dialog before deletion
- Clear visual feedback for destructive actions
- Categories automatically filtered when type changes
- Character counter for description field

### Validation Utilities

The `lib/validation.ts` module provides client-side validation for all forms:

**Transaction Validation:**
- `validateTransactionAmount(amount: string)` - Amount validation
- `validateTransactionDescription(description: string)` - Description validation with XSS prevention
- `validateTransactionCategory(categoryId: string | null)` - Category selection validation
- `validateTransactionDate(date: Date | null)` - Date validation

**Auth Validation:**
- `validateEmail(email: string)` - Email format validation
- `validatePassword(password: string)` - Password strength validation
- `validatePasswordMatch(password: string, confirmPassword: string)` - Password confirmation

**Budget Validation:**
- `validateBudgetAmount(amount: string | null)` - Budget amount validation (greater than 0, max 999,999,999.99)
- `validateBudgetCategory(categoryId: string | null)` - Budget category validation

### Budget Management

#### AddBudgetScreen

Modal screen for creating or updating budgets with intuitive form:

**Features:**
- Month selector for choosing budget period
- Category selector showing only expense categories with color indicators
- Amount input with currency symbol display (USD: $, EUR: €, ILS: ₪)
- Real-time form validation with inline error messages
- Auto-population when editing existing budget
- Preview of current budget if exists
- Loading states and error handling
- Keyboard-aware scrolling for smooth UX

**Access:**
- FAB (Floating Action Button) on Budgets screen

**Navigation:**
- Presented as modal with slide-from-bottom animation
- Cancel button returns to previous screen
- Auto-dismisses on successful creation/update

**Validation:**
- Amount: Required, positive (greater than zero), max 2 decimals, max value 999,999,999.99
- Category: Required, must be an expense category
- Month: Automatically selected from BudgetsScreen context

**Integration:**
- Uses `POST /api/v1/budgets` endpoint for create/update
- Syncs with budgets store on success
- Updates budget list automatically

**User Experience:**
- Categories filtered to show only expense categories
- Existing budgets are automatically updated (upsert behavior)
- Clear visual feedback for form state and errors
- Currency formatting based on user's preferred currency


## State Management

The app uses Zustand for state management with dedicated stores for each domain:

### Stores

- **authStore** - Authentication state (login, logout, token management)
- **accountsStore** - User accounts data and active account management
- **transactionsStore** - Transaction management
- **budgetsStore** - Budget tracking and management
- **categoriesStore** - Category management
- **sharingStore** - Expense sharing and settlement tracking

### accountsStore

Manages user accounts and active account selection. Supports switching between accounts (e.g., personal, shared with partner).

**State:**
```typescript
{
  accounts: Account[]          // User's accounts
  activeAccountId: string | null  // Currently selected account ID
  isLoading: boolean
  error: string | null
}
```

**Actions:**
- `fetchAccounts()` - Load all accounts from API
- `setActiveAccount(accountId)` - Switch active account and persist to backend
- `getActiveAccount()` - Get currently active account object
- `clearError()` - Clear error state
- `reset()` - Reset store to initial state

**Account Types:**
- `PERSONAL` - Individual user account
- `SHARED` - Shared account (e.g., with partner, roommate)

**Usage:**
```typescript
import { useAccountsStore } from '@/stores';

function AccountSwitcher() {
  const {
    accounts,
    activeAccountId,
    setActiveAccount,
    getActiveAccount,
    fetchAccounts,
    isLoading
  } = useAccountsStore();

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAccountSwitch = async (accountId: string) => {
    const success = await setActiveAccount(accountId);
    if (success) {
      // Active account updated, UI will refresh automatically
    }
  };

  const activeAccount = getActiveAccount();

  return (
    // UI implementation
  );
}
```

**API Integration:**
- `GET /api/v1/accounts` - Fetch all user accounts
- `PATCH /api/v1/accounts/[id]/activate` - Switch active account

**Persistence:**
- Active account ID is persisted in the database via the API
- On app start, the store defaults to the first account; server-driven restoration requires fetching user's `activeAccountId` from the API
- Falls back to first account if previous selection no longer exists

See `docs/API_CONTRACTS.md` for detailed API documentation.

---

### sharingStore

Manages expense sharing between users with support for split types and payment tracking.

**State:**
```typescript
{
  sharedByMe: SharedExpense[]           // Expenses you shared with others
  sharedWithMe: SharedWithMeParticipation[]  // Expenses shared with you
  settlementBalances: SettlementBalance[]    // Net balances with each contact
  isLoading: boolean
  error: string | null
}
```

**Actions:**
- `fetchSharing()` - Load all sharing data from API
- `markParticipantPaid(participantId)` - Mark a participant's share as paid (owner only)
- `declineShare(participantId)` - Decline a shared expense
- `cancelSharedExpense(sharedExpenseId)` - Cancel a shared expense (owner only)
- `sendReminder(participantId)` - Send payment reminder to participant
- `lookupUser(email)` - Look up user by email for sharing
- `clearError()` - Clear error state
- `reset()` - Reset store to initial state

**Split Types:**
- `EQUAL` - Split equally among all participants
- `PERCENTAGE` - Split by percentage
- `FIXED` - Fixed amounts per participant

**Payment Status:**
- `PENDING` - Awaiting payment
- `PAID` - Payment confirmed
- `DECLINED` - Participant declined the expense

**Usage:**
```typescript
import { useSharingStore } from '@/stores';

function SharingScreen() {
  const { 
    sharedByMe, 
    sharedWithMe, 
    settlementBalances,
    fetchSharing,
    markParticipantPaid,
    isLoading 
  } = useSharingStore();

  useEffect(() => {
    fetchSharing();
  }, []);

  const handleMarkPaid = async (participantId: string) => {
    try {
      await markParticipantPaid(participantId);
      // Local state updated automatically
    } catch (error) {
      // Handle error
    }
  };

  return (
    // UI implementation
  );
}
```

**API Integration:**
- `GET /api/v1/sharing` - Fetch all sharing data
- `PATCH /api/v1/expenses/shares/[participantId]/paid` - Mark payment received
- `POST /api/v1/expenses/shares/[participantId]/decline` - Decline share
- `DELETE /api/v1/expenses/shares/[sharedExpenseId]` - Cancel shared expense
- `POST /api/v1/expenses/shares/[participantId]/remind` - Send reminder
- `GET /api/v1/users/lookup` - Lookup user by email

See `docs/API_CONTRACTS.md` for detailed API documentation.

## Skeleton Loading Components

The mobile app includes skeleton loading components for smooth loading states. All screens use skeletons during data fetching to provide visual feedback and reduce perceived loading time.

### Architecture

Skeleton components follow a two-tier architecture:

1. **Base Skeleton Component** - Animated pulsing opacity primitive
2. **Composed Screen Skeletons** - Full-screen layouts matching actual content

### Base Skeleton

The `Skeleton` component provides a simple animated loading placeholder with a pulsing opacity effect.

```tsx
import { Skeleton } from '@/components/skeleton';

<Skeleton
  width={200}
  height={20}
  borderRadius={8}
/>
```

**Props:**
- `width` - Width in pixels or string (e.g., '100%')
- `height` - Height in pixels (required)
- `borderRadius` - Corner radius in pixels (default: 4)
- `style` - Optional additional styles
- `testID` - Test ID for testing library queries

**Animation:**
- Loops between 30% and 70% opacity
- 800ms duration per cycle
- Uses native driver for smooth performance

### Screen Skeleton Components

Each main screen has a dedicated skeleton component that mirrors its layout structure:

#### DashboardScreenSkeleton

Shows skeleton version of dashboard with stat cards and recent transactions.

```tsx
import { DashboardScreenSkeleton } from '@/components/skeleton';

{isLoading ? <DashboardScreenSkeleton /> : <DashboardContent />}
```

**Features:**
- Month selector placeholder
- Two stat card skeletons (Income, Expense)
- Budget progress card skeleton
- Recent transactions list with 5 transaction item skeletons

#### TransactionsScreenSkeleton

Shows skeleton version of transactions list with date section headers.

```tsx
import { TransactionsScreenSkeleton } from '@/components/skeleton';

{isLoading ? <TransactionsScreenSkeleton /> : <TransactionsList />}
```

**Features:**
- Two date section headers
- Three transaction item skeletons per section (6 total)
- Matches grouped transaction list structure

#### BudgetsScreenSkeleton

Shows skeleton version of budgets list with category budget cards.

```tsx
import { BudgetsScreenSkeleton } from '@/components/skeleton';

{isLoading ? <BudgetsScreenSkeleton /> : <BudgetsList />}
```

**Features:**
- Month selector placeholder
- Budget progress card skeleton (overall budget summary)
- Four category budget card skeletons
- Matches budget list structure

#### SharingScreenSkeleton

Shows skeleton version of sharing screen with balance cards and shared expense cards.

```tsx
import { SharingScreenSkeleton } from '@/components/skeleton';

{isLoading ? <SharingScreenSkeleton /> : <SharingContent />}
```

**Features:**
- One balance card skeleton (net balance summary)
- "Shared With You" section with 2 expense card skeletons
- "You Shared" section with 2 expense card skeletons
- Matches sharing screen structure

### Atomic Skeleton Components

Individual skeleton components for specific UI elements:

- **SkeletonStatCard** - Dashboard stat card (Spent, Income, Balance)
- **SkeletonBudgetProgressCard** - Overall budget progress card
- **SkeletonBudgetCategoryCard** - Category-specific budget card
- **SkeletonTransactionItem** - Transaction list item
- **SkeletonDateSectionHeader** - Date section divider
- **SkeletonSharedExpenseCard** - Shared expense card
- **SkeletonBalanceCard** - Contact balance card

These components can be used independently for loading states in custom screens or components.

### Implementation Pattern

All main screens follow this pattern:

```tsx
import { DashboardScreenSkeleton } from '@/components/skeleton';

function DashboardScreen() {
  const { isLoading, data } = useStore();

  if (isLoading) {
    return <DashboardScreenSkeleton />;
  }

  return <DashboardContent data={data} />;
}
```

**Benefits:**
- Immediate visual feedback during data fetching
- Reduced perceived loading time
- Consistent loading experience across screens
- Matches actual content structure for smooth transitions

### Testing

All skeleton components have comprehensive test coverage:

```bash
npm test -- Skeleton.test.tsx                     # Base skeleton tests
npm test -- DashboardScreenSkeleton.test.tsx      # Dashboard skeleton tests
npm test -- TransactionsScreenSkeleton.test.tsx   # Transactions skeleton tests
npm test -- BudgetsScreenSkeleton.test.tsx        # Budgets skeleton tests
npm test -- SharingScreenSkeleton.test.tsx        # Sharing skeleton tests
```

Test coverage includes:
- Rendering with correct structure
- Animation setup and cleanup
- Accessibility attributes (progressbar role, loading label)
- Proper testID propagation for integration tests
