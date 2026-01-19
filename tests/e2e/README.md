# E2E Test Suite

Comprehensive end-to-end test suite for Balance Beacon web application using Playwright.

## Overview

This test suite covers:
- **Authentication** (17 tests): Login, registration, password reset, session management
- **Onboarding** (8 tests): Wizard flow, step navigation, redirects
- **Transactions** (8 tests): Create, edit, delete, filter transactions
- **Budgets** (7 tests): Create, edit, delete, filter budgets
- **Sharing** (6 tests): Expense sharing, participants, settlement balances
- **Dashboard** (9 tests): Layout, month navigation, account switching, tabs
- **Settings** (8 tests): Account menu dropdown, export data, sign out, delete account
- **Subscription** (5 tests): Subscription banner, upgrade page, pricing

**Total: 68 web E2E tests**

## Setup

### Prerequisites

1. PostgreSQL database for E2E testing
2. Node.js 20+
3. Playwright browsers

### Environment Configuration

Create `.env.e2e` file with test user credentials:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/balance_beacon_e2e

# Auth secrets
JWT_SECRET=your-jwt-secret-for-e2e
CSRF_SECRET=your-csrf-secret-for-e2e

# Test User 1
AUTH_USER1_EMAIL=e2e-user1@test.example.com
AUTH_USER1_DISPLAY_NAME=TestUserOne
AUTH_USER1_PASSWORD_HASH=$2b$10$...
AUTH_USER1_PREFERRED_CURRENCY=USD

# Test User 2
AUTH_USER2_EMAIL=e2e-user2@test.example.com
AUTH_USER2_DISPLAY_NAME=TestUserTwo
AUTH_USER2_PASSWORD_HASH=$2b$10$...
AUTH_USER2_PREFERRED_CURRENCY=USD
```

### Database Setup

```bash
# Push schema to E2E database
npm run db:push

# Seed test data
npm run db:seed:e2e
```

## Running Tests

### Run all E2E tests

```bash
npm run test:e2e
```

### Run specific test file

```bash
npx playwright test tests/e2e/auth.spec.ts
```

### Run tests in UI mode (for debugging)

```bash
npx playwright test --ui
```

### Run tests with headed browser

```bash
npx playwright test --headed
```

### Run specific test by name

```bash
npx playwright test -g "should successfully login"
```

## Test Structure

### Page Object Model

Test pages are organized in `tests/e2e/pages/`:
- `base-page.ts` - Common methods for all pages
- `login-page.ts` - Authentication flows
- `dashboard-page.ts` - Main dashboard interactions
- `transactions-page.ts` - Transaction management
- `budgets-page.ts` - Budget management
- `sharing-page.ts` - Expense sharing features

### Helpers

Reusable utilities in `tests/e2e/helpers/`:
- `auth-helpers.ts` - Login/logout functions
- `fixtures.ts` - Test users, categories, date helpers

### Test Specs

Test files in `tests/e2e/`:
- `auth.spec.ts` - Authentication tests
- `onboarding.spec.ts` - Onboarding wizard tests
- `transactions.spec.ts` - Transaction CRUD tests
- `budgets.spec.ts` - Budget CRUD tests
- `sharing.spec.ts` - Expense sharing tests
- `dashboard.spec.ts` - Dashboard navigation tests
- `settings.spec.ts` - Settings page tests
- `subscription.spec.ts` - Subscription flow tests

## Writing Tests

### Example Test

```typescript
import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'
import { TransactionsPage } from './pages/transactions-page'

test.describe('transactions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test('should create a new transaction', async ({ page }) => {
    const transactionsPage = new TransactionsPage(page)

    await transactionsPage.navigateToTransactionsTab()
    await transactionsPage.fillTransactionForm({
      category: 'Groceries',
      amount: '50.00',
      date: '2024-01-15',
      description: 'Weekly groceries',
    })
    await transactionsPage.submitTransaction()

    await expect(page.getByText(/transaction created/i)).toBeVisible()
  })
})
```

### Best Practices

1. **Use Page Objects**: Encapsulate page interactions in page classes
2. **Use Helpers**: Reuse common flows like login/logout
3. **Accessibility Selectors**: Prefer `getByRole`, `getByLabel`, `getByText`
4. **Test Isolation**: Each test should be independent
5. **Clean Up**: Always logout after tests that require authentication
6. **Descriptive Names**: Use clear, descriptive test names
7. **Proper Waits**: Use explicit waits (`waitForSelector`, `waitForLoadState`) instead of arbitrary timeouts (`waitForTimeout`)

### Architecture Notes

**Settings UI**: The settings functionality is implemented as a dropdown menu triggered by an "Account" button in the header, not as a dedicated `/settings` page route. Tests should use:
- `page.getByRole('button', { name: /account/i })` to open the menu
- `page.getByRole('menu', { name: /account settings/i })` to interact with the dropdown
- `page.getByRole('menuitem', { name: /.../ })` for menu options


## CI/CD

Tests run automatically on:
- Pull requests to main
- Push to main branch
- Manual workflow dispatch

### GitHub Actions Workflow

See `.github/workflows/e2e-web.yml` for CI configuration.

Required GitHub secrets:
- `E2E_USER1_EMAIL`
- `E2E_USER1_DISPLAY_NAME`
- `E2E_USER1_PASSWORD_HASH`
- `E2E_USER2_EMAIL`
- `E2E_USER2_DISPLAY_NAME`
- `E2E_USER2_PASSWORD_HASH`
- `E2E_JWT_SECRET`
- `E2E_CSRF_SECRET`

## Debugging

### View test traces

```bash
npx playwright show-trace test-results/[test-name]/trace.zip
```

### Generate HTML report

```bash
npx playwright show-report
```

### Screenshots

Failed tests automatically capture screenshots in `test-results/`.

### Videos

Videos are recorded on first retry for failed tests.

## Configuration

See `playwright.config.ts` for:
- Test timeout (60 seconds)
- Expect timeout (5 seconds)
- Browser configuration
- Base URL
- Retry strategy
- Dev server configuration

## Troubleshooting

### Tests timing out

Increase timeout in `playwright.config.ts`:
```typescript
timeout: 120_000, // 2 minutes
```

### Database connection issues

Verify DATABASE_URL in `.env.e2e` and ensure PostgreSQL is running.

### Authentication failures

Ensure test users exist in database. Re-run `npm run db:seed:e2e`.

### Flaky tests

Run with retries:
```bash
npx playwright test --retries=2
```

