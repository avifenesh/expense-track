# Mobile App E2E Contract

This document is the source of truth for E2E tests. Each section defines what the app MUST do.
Tests verify these contracts - nothing more, nothing less.

---

## Navigation Structure

```
App Launch
├── Not Authenticated → AuthStack
│   ├── LoginScreen (default)
│   ├── RegisterScreen
│   ├── VerifyEmailScreen
│   └── ResetPasswordScreen
├── Authenticated + Not Onboarded → OnboardingStack
│   ├── OnboardingWelcomeScreen
│   ├── OnboardingCurrencyScreen
│   ├── OnboardingCategoriesScreen
│   ├── OnboardingBudgetScreen
│   ├── OnboardingSampleDataScreen
│   ├── OnboardingCompleteScreen
│   └── OnboardingBiometricScreen
└── Authenticated + Onboarded → AppStack
    ├── MainTabs
    │   ├── Dashboard (Home)
    │   ├── Transactions
    │   ├── Budgets
    │   ├── Sharing
    │   └── Settings
    └── Modals
        ├── AddTransactionScreen
        ├── EditTransactionScreen
        └── ShareExpenseScreen
```

---

## AUTH CONTRACTS

### AUTH-001: Login with valid credentials
**Given:** User on LoginScreen with valid account
**When:** User enters email, password, taps "Sign In"
**Then:**
- Loading spinner shown on button
- On success: Navigate to Dashboard (or Onboarding if not completed)
- User sees Dashboard with their data

**TestIDs:**
- Screen: `login.screen`
- Email: `login.emailInput`
- Password: `login.passwordInput`
- Submit: `login.submitButton`

**API:** `POST /auth/login` → `{ accessToken, refreshToken }`

---

### AUTH-002: Login with invalid credentials
**Given:** User on LoginScreen
**When:** User enters wrong email/password, taps "Sign In"
**Then:**
- Error message displayed: "Invalid email or password"
- User remains on LoginScreen
- Inputs not cleared

**API:** `POST /auth/login` → 401 Unauthorized

---

### AUTH-003: Login with invalid email format
**Given:** User on LoginScreen
**When:** User enters invalid email format (e.g., "notanemail")
**Then:**
- Client-side validation error shown below email field
- Submit button may be disabled or show error on tap
- No API call made

---

### AUTH-004: Navigate to Register
**Given:** User on LoginScreen
**When:** User taps "Create an account" link
**Then:** Navigate to RegisterScreen

**TestIDs:**
- Link: `login.registerLink`

---

### AUTH-005: Navigate to Reset Password
**Given:** User on LoginScreen
**When:** User taps "Forgot password?" link
**Then:** Navigate to ResetPasswordScreen

**TestIDs:**
- Link: `login.resetPasswordLink`

---

### AUTH-006: Register new account
**Given:** User on RegisterScreen
**When:** User enters valid displayName, email, password, taps "Create Account"
**Then:**
- Loading spinner shown
- On success: Navigate to VerifyEmailScreen with email shown
- User sees "Check your email" message

**TestIDs:**
- Screen: `register.screen`
- DisplayName: `register.displayNameInput`
- Email: `register.emailInput`
- Password: `register.passwordInput`
- Submit: `register.submitButton`

**API:** `POST /auth/register` → success

---

### AUTH-007: Register with existing email
**Given:** User on RegisterScreen
**When:** User enters email that already exists
**Then:**
- Error shown: email already registered
- User remains on RegisterScreen

**API:** `POST /auth/register` → 400 with email error

---

### AUTH-008: Register password requirements
**Given:** User on RegisterScreen, focused on password field
**When:** User types password
**Then:**
- Password requirements shown with checkmarks for met requirements:
  - Minimum 8 characters
  - One uppercase letter
  - One lowercase letter
  - One number
  - One special character

---

### AUTH-009: Request password reset
**Given:** User on ResetPasswordScreen
**When:** User enters email, taps "Send Reset Link"
**Then:**
- Loading spinner shown
- On success: Show confirmation message
- Message: "If an account exists with [email], you will receive a password reset link"

**TestIDs:**
- Screen: `resetPassword.screen`
- Email: `resetPassword.emailInput`
- Submit: `resetPassword.requestButton`

**API:** `POST /auth/request-reset` → success (always returns success for security)

---

### AUTH-010: Resend verification email
**Given:** User on VerifyEmailScreen
**When:** User taps "Resend Email"
**Then:**
- Email sent
- Button disabled for 60 seconds
- Countdown shown: "Resend in 59s"

**TestIDs:**
- Screen: `verifyEmail.screen`
- Resend: `verifyEmail.resendButton`
- Back: `verifyEmail.backButton`

**API:** `POST /auth/resend-verification` → success

---

### AUTH-011: Biometric login (if available)
**Given:** User on LoginScreen, biometric enabled, credentials saved
**When:** User taps biometric button
**Then:**
- System biometric prompt shown
- On success: Navigate to Dashboard

**TestIDs:**
- Button: `login.biometricButton`

---

### AUTH-012: Rate limiting
**Given:** User on LoginScreen
**When:** User fails login 5+ times rapidly
**Then:**
- Error: "Too many attempts. Please try again later."
- User must wait before retrying

**API:** `POST /auth/login` → 429 Rate Limited

---

## ONBOARDING CONTRACTS

### ONB-001: Welcome screen
**Given:** Authenticated user who hasn't completed onboarding
**When:** App loads
**Then:**
- OnboardingWelcomeScreen shown
- Title: "Welcome"
- "Get Started" button visible

**TestIDs:**
- Screen: `onboarding.welcome.screen`
- Button: `onboarding.welcome.getStartedButton`

---

### ONB-002: Currency selection
**Given:** User on OnboardingCurrencyScreen
**When:** User selects currency and taps "Next"
**Then:**
- Currency saved to preferences
- Navigate to OnboardingCategoriesScreen

**Options:** USD, EUR, ILS

---

### ONB-003: Category selection
**Given:** User on OnboardingCategoriesScreen
**When:** User selects categories and taps "Next"
**Then:**
- Selected categories created for user
- Navigate to OnboardingBudgetScreen

**API:** `POST /categories/bulk`

---

### ONB-004: Budget setup (optional)
**Given:** User on OnboardingBudgetScreen
**When:** User enters budgets (or skips) and taps "Next"
**Then:**
- Budgets created if entered
- Navigate to OnboardingSampleDataScreen

**API:** `POST /budgets/quick` (if budgets entered)

---

### ONB-005: Sample data choice
**Given:** User on OnboardingSampleDataScreen
**When:** User chooses "Yes" or "No" for sample data
**Then:**
- If Yes: Sample transactions created
- Navigate to OnboardingCompleteScreen

**API:** `POST /seed-data` (if Yes)

---

### ONB-006: Biometric setup
**Given:** User on OnboardingBiometricScreen
**When:** User taps "Enable" or "Skip"
**Then:**
- If Enable: Biometric enabled, credentials saved
- Mark onboarding complete
- Navigate to Dashboard

**TestIDs:**
- Screen: `onboarding.biometric.screen`
- Enable: `onboarding.biometric.enableButton`
- Skip: `onboarding.biometric.skipButton`

**API:** `PATCH /users/me` → `{ hasCompletedOnboarding: true }`

---

## DASHBOARD CONTRACTS

### DASH-001: Dashboard loads with data
**Given:** Authenticated user with account and transactions
**When:** Dashboard loads
**Then:**
- Month selector shows current month
- Budget progress card shows total planned vs spent
- Income card shows total income for month
- Expenses card shows total expenses for month
- Recent transactions list shows up to 5 transactions

**TestIDs:**
- Screen: `dashboard.screen`
- Month selector: `dashboard.monthSelector`
- FAB: `dashboard.addTransactionFab`

**APIs:**
- `GET /accounts`
- `GET /transactions?accountId={id}&month={month}`
- `GET /budgets?accountId={id}&month={month}`

---

### DASH-002: Dashboard empty state
**Given:** Authenticated user with no transactions
**When:** Dashboard loads
**Then:**
- Budget progress shows $0 / $0
- Income shows $0
- Expenses shows $0
- "No recent transactions" or empty list

---

### DASH-003: Change month
**Given:** User on Dashboard
**When:** User taps month selector, selects different month
**Then:**
- Data refreshes for selected month
- All cards update with new month's data

---

### DASH-004: Pull to refresh
**Given:** User on Dashboard
**When:** User pulls down to refresh
**Then:**
- Refresh indicator shown
- All data reloaded
- Refresh indicator hides

**TestIDs:**
- RefreshControl: `dashboard.refreshControl`

---

### DASH-005: Tap transaction navigates to edit
**Given:** User on Dashboard with transactions
**When:** User taps a transaction
**Then:** Navigate to EditTransactionScreen with that transaction

**TestIDs:**
- Transaction item: `dashboard.transaction.{index}`

---

### DASH-006: FAB opens add transaction
**Given:** User on Dashboard
**When:** User taps FAB (+)
**Then:** AddTransactionScreen modal opens

---

## TRANSACTIONS CONTRACTS

### TXN-001: Transaction list loads
**Given:** User on TransactionsScreen
**When:** Screen loads
**Then:**
- Transactions loaded and displayed
- Grouped by date (section headers)
- Filter chips: All, Income, Expenses (All selected by default)

**TestIDs:**
- Screen: `transactions.screen`
- Filter All: `transactions.filter.all`
- Filter Income: `transactions.filter.income`
- Filter Expenses: `transactions.filter.expense`
- Add button: `transactions.addButton`

**API:** `GET /transactions?accountId={id}&limit=50`

---

### TXN-002: Filter by type
**Given:** User on TransactionsScreen
**When:** User taps "Income" filter
**Then:**
- Only income transactions shown
- "Income" chip highlighted
- List refreshes

**API:** `GET /transactions?accountId={id}&type=INCOME`

---

### TXN-003: Filter by expenses
**Given:** User on TransactionsScreen
**When:** User taps "Expenses" filter
**Then:**
- Only expense transactions shown
- "Expenses" chip highlighted

**API:** `GET /transactions?accountId={id}&type=EXPENSE`

---

### TXN-004: Load more on scroll
**Given:** User on TransactionsScreen with 50+ transactions
**When:** User scrolls to 70% of list
**Then:**
- Loading indicator shown
- More transactions loaded
- List extends

**API:** `GET /transactions?accountId={id}&offset=50&limit=50`

---

### TXN-005: Empty state
**Given:** User on TransactionsScreen with no transactions
**When:** Screen loads
**Then:**
- "No transactions" message shown
- Filter-specific hint if filter active

---

### TXN-006: Add transaction button
**Given:** User on TransactionsScreen
**When:** User taps "Add" button
**Then:** AddTransactionScreen modal opens

---

## ADD TRANSACTION CONTRACTS

### ADD-001: Add expense
**Given:** User on AddTransactionScreen
**When:** User fills:
- Type: EXPENSE (default)
- Amount: 25.50
- Category: (any expense category)
- Date: Today (default)
- Description: "Lunch" (optional)
And taps "Save Transaction"
**Then:**
- Transaction created
- Modal closes
- Transaction appears in list

**TestIDs:**
- Screen: `addTransaction.screen`
- Cancel: `addTransaction.cancelButton`
- Type Expense: `addTransaction.type.expense`
- Type Income: `addTransaction.type.income`
- Amount: `addTransaction.amountInput`
- Category: `addTransaction.category.{name}`
- Date Today: `addTransaction.date.today`
- Date Yesterday: `addTransaction.date.yesterday`
- Date Other: `addTransaction.date.other`
- Description: `addTransaction.descriptionInput`
- Submit: `addTransaction.submitButton`

**API:** `POST /transactions`
```json
{
  "accountId": "string",
  "categoryId": "string",
  "type": "EXPENSE",
  "amount": 25.50,
  "currency": "USD",
  "date": "2024-01-15",
  "description": "Lunch"
}
```

---

### ADD-002: Add income
**Given:** User on AddTransactionScreen
**When:** User:
- Taps "Income" type
- Enters amount
- Selects income category
- Taps "Save Transaction"
**Then:**
- Transaction created with type INCOME
- Modal closes

---

### ADD-003: Amount validation
**Given:** User on AddTransactionScreen
**When:** User enters invalid amount (0, negative, or > 2 decimals)
**Then:**
- Validation error shown
- Cannot submit

---

### ADD-004: Category required
**Given:** User on AddTransactionScreen
**When:** User enters amount but no category, taps Submit
**Then:**
- Error: category required
- Cannot submit

---

### ADD-005: Cancel closes modal
**Given:** User on AddTransactionScreen with unsaved data
**When:** User taps "Cancel"
**Then:**
- Modal closes
- No transaction created

---

### ADD-006: Type toggle clears category
**Given:** User on AddTransactionScreen with expense category selected
**When:** User taps "Income" type
**Then:**
- Category selection cleared
- Income categories now shown

---

### ADD-007: Date picker
**Given:** User on AddTransactionScreen
**When:** User taps "Other" date option
**Then:**
- Date picker modal opens
- Can select date from past 7 days
- Selected date shown after picking

---

### ADD-008: Description character limit
**Given:** User on AddTransactionScreen
**When:** User types in description
**Then:**
- Character count shown (e.g., "45/200")
- Cannot exceed 200 characters

---

## EDIT TRANSACTION CONTRACTS

### EDIT-001: Edit screen pre-filled
**Given:** User navigates to EditTransactionScreen for existing transaction
**When:** Screen loads
**Then:**
- All fields pre-filled with transaction data
- Type, amount, category, date, description all shown
- "Delete" button visible at bottom

**TestIDs:**
- Screen: `editTransaction.screen`

---

### EDIT-002: Update transaction
**Given:** User on EditTransactionScreen
**When:** User changes amount and taps "Update Transaction"
**Then:**
- Transaction updated
- Modal closes
- Updated transaction shown in list

**API:** `PUT /transactions/{id}`

---

### EDIT-003: Delete transaction
**Given:** User on EditTransactionScreen
**When:** User taps "Delete"
**Then:**
- Confirmation dialog: "Delete Transaction? This action cannot be undone."
- If user confirms: Transaction deleted, modal closes
- If user cancels: Stay on edit screen

**API:** `DELETE /transactions/{id}`

---

## BUDGETS CONTRACTS

### BUD-001: Budgets list loads
**Given:** User on BudgetsScreen with budgets
**When:** Screen loads
**Then:**
- Month selector shows current month
- Total budget progress card (planned vs spent)
- Category budget cards with:
  - Category name and color
  - Planned amount
  - Spent amount (from transactions)
  - Progress bar

**TestIDs:**
- Screen: `budgets.screen`

**APIs:**
- `GET /budgets?accountId={id}&month={month}`
- `GET /categories?type=EXPENSE`
- `GET /transactions?accountId={id}&month={month}`

---

### BUD-002: Budget progress calculation
**Given:** Budget has planned=$500, transactions total=$350
**When:** User views budget card
**Then:**
- Progress bar at 70%
- Shows "$350 / $500"

---

### BUD-003: Over budget indicator
**Given:** Budget has planned=$500, transactions total=$600
**When:** User views budget card
**Then:**
- Progress bar full + red/warning color
- Shows "$600 / $500" or "Over budget by $100"

---

### BUD-004: Change month
**Given:** User on BudgetsScreen
**When:** User changes month
**Then:**
- Budgets refresh for new month
- Spending recalculated from that month's transactions

---

### BUD-005: Empty budgets state
**Given:** User on BudgetsScreen with no budgets
**When:** Screen loads
**Then:**
- Message: "No budgets set for this month"
- Possibly "Add Budget" action

---

## SHARING CONTRACTS

### SHARE-001: Sharing screen loads
**Given:** User on SharingScreen
**When:** Screen loads
**Then:**
- Net balance card (You owe X / You are owed X / All settled)
- "Shared With You" section (if any)
- "You Shared" section (if any)

**TestIDs:**
- Screen: `sharing.screen`
- Share button: `share-expense-button`

**API:** `GET /sharing`

---

### SHARE-002: Net balance calculation
**Given:** User has shared expenses
**When:** Screen loads
**Then:**
- Net balance = sum(what others owe me) - sum(what I owe others)
- Positive: "You are owed $X"
- Negative: "You owe $X"
- Zero: "All settled up"

---

### SHARE-003: Shared with me - pending
**Given:** Someone shared expense with user, status PENDING
**When:** User views "Shared With You"
**Then:**
- Shows expense description
- Shows "From: [Name]"
- Shows amount: "You owe $X"
- Status badge: PENDING

---

### SHARE-004: Mark participant as paid
**Given:** User shared expense, participant status PENDING
**When:** User taps "Mark Paid" on participant
**Then:**
- Participant status → PAID
- Settlement balance updates

**API:** `PATCH /expenses/shares/{participantId}/paid`

---

### SHARE-005: Share expense flow
**Given:** User on SharingScreen
**When:** User taps "+ Share" button
**Then:**
- Transaction picker modal opens
- User selects transaction
- Navigate to ShareExpenseScreen

---

### SHARE-006: Empty sharing state
**Given:** User with no shared expenses
**When:** SharingScreen loads
**Then:**
- "All settled up" or $0 balance
- Empty sections with helpful text

---

## SHARE EXPENSE CONTRACTS

### SHEXP-001: Share expense screen
**Given:** User on ShareExpenseScreen with selected transaction
**When:** Screen loads
**Then:**
- Transaction card shown (amount, description, category)
- Split type options: EQUAL, PERCENTAGE, FIXED
- Add participants section
- Submit button

**TestIDs:**
- Screen: `shareExpense.screen`
- Split type: `split-type-{EQUAL|PERCENTAGE|FIXED}`
- Email input: `participant-email-input`
- Add button: `add-participant-button`
- Submit: `submit-share-button`

---

### SHEXP-002: Add participant by email
**Given:** User on ShareExpenseScreen
**When:** User enters email, taps "Add"
**Then:**
- Email validated
- User lookup performed
- If found: Participant added with name
- If not found: Participant added with email only (invited)

**API:** `GET /users/lookup?email={email}`

---

### SHEXP-003: Equal split
**Given:** Transaction=$100, 2 participants added
**When:** Split type = EQUAL
**Then:**
- Your share: $33.33
- Each participant: $33.33
- Total: $100

---

### SHEXP-004: Percentage split
**Given:** Transaction=$100, 1 participant
**When:** Split type = PERCENTAGE
**Then:**
- Percentage inputs shown
- User enters 60% for self, 40% for participant
- Your share: $60, Participant: $40

---

### SHEXP-005: Fixed split
**Given:** Transaction=$100, 1 participant
**When:** Split type = FIXED
**Then:**
- Amount inputs shown
- User enters $70 for self, $30 for participant
- Validates total = transaction amount

---

### SHEXP-006: Submit shared expense
**Given:** User has added participants and set split
**When:** User taps "Share Expense"
**Then:**
- Shared expense created
- Participants notified
- Navigate back to SharingScreen
- New shared expense visible

**API:** `POST /expenses/share`

---

### SHEXP-007: Validation - no participants
**Given:** User on ShareExpenseScreen
**When:** User tries to submit with 0 participants
**Then:**
- Error: "Add at least one participant"
- Cannot submit

---

## SETTINGS CONTRACTS

### SET-001: Settings screen
**Given:** User on SettingsScreen
**When:** Screen loads
**Then:**
- Account section: Profile, Currency, Accounts, Categories
- Security section: Biometric toggle (if available)
- Data section: Export Data, Delete Account
- About section: Privacy Policy, Terms, Version
- Sign Out button at bottom

**TestIDs:**
- Screen: `settings.screen`
- Biometric switch: `biometric-switch`
- Logout: `settings.logoutButton`

---

### SET-002: Toggle biometric
**Given:** User on SettingsScreen, device supports biometric
**When:** User toggles biometric switch
**Then:**
- If enabling: Biometric auth prompt, credentials saved
- If disabling: Credentials deleted
- Switch reflects new state

---

### SET-003: Sign out
**Given:** User on SettingsScreen
**When:** User taps "Sign Out"
**Then:**
- User logged out
- Navigate to LoginScreen
- Stored tokens cleared

**API:** `POST /auth/logout`

---

## ERROR HANDLING CONTRACTS

### ERR-001: Network error
**Given:** User performs action requiring network
**When:** Network unavailable
**Then:**
- Error message: "Network error. Please check your connection."
- User can retry action

---

### ERR-002: Session expired
**Given:** User's access token expired
**When:** API call made
**Then:**
- Refresh token used to get new access token
- If refresh fails: Navigate to LoginScreen
- Message: "Session expired. Please sign in again."

---

### ERR-003: Server error
**Given:** Server returns 500 error
**When:** Any API call
**Then:**
- Error message displayed
- User can retry

---

### ERR-004: Offline transaction queue
**Given:** User adds transaction while offline
**When:** Transaction created
**Then:**
- Transaction queued locally
- Shown in list with "pending sync" indicator
- Synced when connection restored

---

## TAB NAVIGATION CONTRACTS

### NAV-001: Tab navigation
**Given:** User in AppStack
**When:** User taps tab (Dashboard, Transactions, Budgets, Sharing, Settings)
**Then:**
- Navigate to corresponding screen
- Tab icon highlighted

---

### NAV-002: Tab state persistence
**Given:** User on TransactionsScreen with filter applied
**When:** User navigates to Dashboard, then back to Transactions
**Then:**
- Filter state preserved
- Same view shown

---

### NAV-003: Deep link handling
**Given:** App receives deep link
**When:** Link processed
**Then:**
- Navigate to appropriate screen
- If not authenticated: Show login first, then navigate after auth

---

## API RESPONSE CONTRACTS

### Standard Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Standard Error Response
```json
{
  "success": false,
  "error": "Human readable message",
  "code": "ERROR_CODE",
  "details": {
    "field": ["error message"]
  }
}
```

### Error Codes
| Code | Status | Meaning |
|------|--------|---------|
| UNAUTHORIZED | 401 | Invalid/expired token |
| FORBIDDEN | 403 | Permission denied |
| RATE_LIMITED | 429 | Too many requests |
| VALIDATION_ERROR | 400 | Invalid input |
| NOT_FOUND | 404 | Resource not found |
| SERVER_ERROR | 500 | Internal error |

---

## TestID Reference

### Auth Screens
| Screen | TestID |
|--------|--------|
| LoginScreen | `login.screen` |
| RegisterScreen | `register.screen` |
| ResetPasswordScreen | `resetPassword.screen` |
| VerifyEmailScreen | `verifyEmail.screen` |

### Onboarding Screens
| Screen | TestID |
|--------|--------|
| Welcome | `onboarding.welcome.screen` |
| Biometric | `onboarding.biometric.screen` |

### Main Screens
| Screen | TestID |
|--------|--------|
| Dashboard | `dashboard.screen` |
| Transactions | `transactions.screen` |
| Budgets | `budgets.screen` |
| Sharing | `sharing.screen` |
| Settings | `settings.screen` |

### Modal Screens
| Screen | TestID |
|--------|--------|
| AddTransaction | `addTransaction.screen` |
| EditTransaction | `editTransaction.screen` |
| ShareExpense | `shareExpense.screen` |

---

## Test Categories

Tests should be organized by these categories:

1. **Smoke Tests** - App launches, screens render
2. **Auth Tests** - Login, register, reset password, biometric
3. **Onboarding Tests** - Full onboarding flow
4. **Transaction Tests** - CRUD operations, filters
5. **Budget Tests** - View budgets, month navigation
6. **Sharing Tests** - Share expense, mark paid
7. **Settings Tests** - Biometric toggle, logout
8. **Error Tests** - Network errors, validation errors
9. **Navigation Tests** - Tab navigation, modal flows
