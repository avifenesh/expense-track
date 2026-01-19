# Implementation Plan: Comprehensive E2E Test Suite for Web and Mobile

**Task**: #261
**Branch**: `feature/e2e-test-suite`
**Complexity**: High
**Estimated Time**: 45 hours (5-6 days)

## Overview

Build comprehensive E2E test coverage from scratch: 45 Playwright tests for web and 32 Detox tests for mobile. Includes test infrastructure, Page Object Models, auth helpers, E2E seeding, and CI/CD workflows.

## Architecture Decision

- **Web**: Page Object Model pattern with Playwright
- **Mobile**: Screen Object Model pattern with Detox
- **Data**: Separate E2E database seeding for clean test data
- **CI**: GitHub Actions workflows with artifact upload on failure

---

## Step 1: Web Test Infrastructure - Page Objects and Helpers

**Goal**: Create Page Object Model structure and auth helpers for web E2E tests

**Files to create**:
- `tests/e2e/pages/base-page.ts` - BasePage class with common actions
- `tests/e2e/pages/login-page.ts` - LoginPage with form locators
- `tests/e2e/pages/register-page.ts` - RegisterPage
- `tests/e2e/pages/dashboard-page.ts` - DashboardPage
- `tests/e2e/pages/onboarding-page.ts` - OnboardingPage
- `tests/e2e/pages/transactions-page.ts` - TransactionsPage
- `tests/e2e/pages/budgets-page.ts` - BudgetsPage
- `tests/e2e/pages/sharing-page.ts` - SharingPage
- `tests/e2e/pages/settings-page.ts` - SettingsPage
- `tests/e2e/helpers/auth-helpers.ts` - Login, logout, session helpers
- `tests/e2e/helpers/fixtures.ts` - Test data fixtures

---

## Step 2: Web E2E Tests - Auth and Onboarding (16 tests)

**Goal**: Test authentication flows and onboarding experience

**Files**:
- `tests/e2e/auth.spec.ts` - Expand to 8 tests (login, register, verify, reset, logout, switch)
- `tests/e2e/onboarding.spec.ts` - 8 tests (currency, categories, complete flow)

---

## Step 3: Web E2E Tests - Transactions (7 tests)

**Goal**: Test transaction CRUD operations

**File**: `tests/e2e/transactions.spec.ts`
- Add transaction (expense, income)
- Edit transaction
- Delete with confirmation
- Form validation
- Filtering and search

---

## Step 4: Web E2E Tests - Budgets (6 tests)

**Goal**: Test budget creation, editing, and progress tracking

**File**: `tests/e2e/budgets.spec.ts`
- Create budget
- Edit budget
- Delete budget
- Progress calculation
- Overspending warning

---

## Step 5: Web E2E Tests - Sharing (5 tests)

**Goal**: Test expense sharing between users

**File**: `tests/e2e/sharing.spec.ts`
- Create shared expense
- View splits
- Settle expense
- Shared account transactions

---

## Step 6: Web E2E Tests - Dashboard, Settings, Subscription (11 tests)

**Goal**: Test dashboard overview, settings, and subscription enforcement

**Files**:
- `tests/e2e/dashboard.spec.ts` - 4 tests (stats, filters)
- `tests/e2e/settings.spec.ts` - 4 tests (categories, accounts)
- `tests/e2e/subscription.spec.ts` - 3 tests (trial, enforcement, upgrade)

---

## Step 7: E2E Database Seeding Script

**Goal**: Create dedicated E2E seed script with known test data

**Files**:
- `prisma/seed-e2e.ts` - Seed script with test users, accounts, transactions
- `scripts/seed-e2e.sh` - Shell script to run seeding
- `.env.e2e` - Update with test credentials
- `package.json` - Add `db:seed:e2e` script

---

## Step 8: Web CI/CD Workflow

**Goal**: Add GitHub Actions workflow for web E2E tests

**File**: `.github/workflows/e2e-web.yml`
- Postgres service container
- Playwright browser installation
- Run seed-e2e before tests
- Upload artifacts on failure

---

## Step 9: Mobile Detox Setup and Configuration

**Goal**: Install Detox, configure for iOS/Android

**Files**:
- `mobile/package.json` - Add detox dependencies
- `mobile/detox.config.js` - Detox configuration
- `mobile/e2e/init.ts` - Setup/teardown hooks
- `mobile/e2e/helpers/screen-helpers.ts` - Common screen actions
- `mobile/e2e/helpers/auth-helpers.ts` - Mobile auth helpers
- `mobile/e2e/helpers/fixtures.ts` - Mobile fixtures

**Risks**: iOS requires macOS; Android emulator setup can be complex

---

## Step 10: Mobile testID Additions to Screens

**Goal**: Add testID props to all interactive elements

**Files to modify** (30+ files):
- `mobile/src/screens/auth/*.tsx` - Add testIDs
- `mobile/src/screens/onboarding/*.tsx` - Add testIDs
- `mobile/src/screens/main/*.tsx` - Add testIDs
- `mobile/src/components/forms/*.tsx` - Add testID props
- `mobile/src/navigation/MainTabNavigator.tsx` - Tab testIDs

**Naming Convention**: `<screen>.<element>`, e.g., `login.emailInput`

---

## Step 11: Mobile E2E Tests - Auth and Onboarding (14 tests)

**Goal**: Test mobile authentication and onboarding

**Files**:
- `mobile/e2e/auth.e2e.ts` - 8 tests (login, register, logout, biometric)
- `mobile/e2e/onboarding.e2e.ts` - 6 tests (welcome, currency, categories)

---

## Step 12: Mobile E2E Tests - Transactions and Budgets (10 tests)

**Goal**: Test transaction and budget management on mobile

**Files**:
- `mobile/e2e/transactions.e2e.ts` - 6 tests (add, edit, delete, list)
- `mobile/e2e/budgets.e2e.ts` - 4 tests (view, details, progress)

---

## Step 13: Mobile E2E Tests - Sharing, Navigation, Settings, Errors (8 tests)

**Goal**: Test remaining mobile features

**Files**:
- `mobile/e2e/sharing.e2e.ts` - 2 tests
- `mobile/e2e/navigation.e2e.ts` - 2 tests
- `mobile/e2e/settings.e2e.ts` - 2 tests
- `mobile/e2e/errors.e2e.ts` - 2 tests

---

## Step 14: Mobile CI/CD Workflow

**Goal**: Add GitHub Actions workflow for mobile E2E tests

**File**: `.github/workflows/e2e-mobile.yml`
- iOS simulator (macOS runner)
- Android emulator (Linux runner)
- Detox build and test
- Artifact upload

---

## Step 15: Documentation and Test Maintenance

**Goal**: Document E2E test suite

**Files**:
- `docs/E2E_TESTING.md` - Comprehensive testing guide
- `README.md` - Add E2E testing section
- `mobile/README.md` - Mobile E2E section
- `.env.e2e.example` - Example environment variables

---

## Critical Paths

**High Risk**:
- Mobile testID additions (30+ files)
- Detox setup complexity
- E2E database seeding consistency
- Multi-user sharing tests

**Needs Review**:
- Detox configuration before writing tests
- testID naming convention
- CI workflow permissions

**Security**:
- E2E credentials must be non-production
- E2E database isolation
- CI secrets for database credentials

---

## Test Count Summary

| Platform | Tests | Priority |
|----------|-------|----------|
| Web Auth & Onboarding | 16 | P0 |
| Web Transactions | 7 | P0 |
| Web Budgets | 6 | P0 |
| Web Sharing | 5 | P0 |
| Web Dashboard/Settings/Sub | 11 | P0-P1 |
| **Web Total** | **45** | |
| Mobile Auth & Onboarding | 14 | P0 |
| Mobile Transactions/Budgets | 10 | P0 |
| Mobile Other | 8 | P0-P1 |
| **Mobile Total** | **32** | |
| **Grand Total** | **77** | |

---

## Success Criteria

- [ ] 45 web E2E tests passing locally and in CI
- [ ] 32 mobile E2E tests passing locally
- [ ] Web E2E < 15 minutes
- [ ] Mobile E2E < 30 minutes
- [ ] All tests green on every PR
- [ ] Documentation complete
