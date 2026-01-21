# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- Pricing: Updated from $5/month to $3/month (#274)
  - Reduced subscription price constant to 300 cents ($3.00)
  - Updated pricing display across all pages
  - Updated legal terms and documentation

### Added
- Web: Enhanced pricing page with feature comparison table (#274)
  - Free trial vs Premium comparison table
  - Visual feature breakdown with checkmarks
  - Back navigation to app
  - Pricing page E2E test suite
  - Comprehensive unit tests for comparison table

### Fixed
- Web: E2E test locator fixes and improvements (#263)
  - Fixed 45+ flaky test locators across 8 spec files
  - Settings tests refactored to use account dropdown menu (not /settings page)
  - Replaced all `waitForTimeout` calls with proper explicit waits
  - Re-enabled E2E CI workflow for pull requests
  - Updated test counts: 68 total tests (was 45)
  - Added architecture notes to E2E documentation


### Added
- Web: Comprehensive E2E test suite with Playwright (#261)
  - 45 web E2E tests covering authentication, onboarding, transactions, budgets, sharing, dashboard, settings, subscription
  - Page Object Model pattern for test organization
  - Auth helpers and test fixtures for reusable flows
  - E2E database seeding script with test data
  - GitHub Actions CI workflow for automated testing
  - Comprehensive E2E documentation at tests/e2e/README.md
- Mobile: MonthSelector component for month navigation (#223)
  - Previous/next arrow buttons for month navigation
  - Tap on month label opens modal picker
  - Modal with year selector and month grid (4 columns x 3 rows)
  - Support for min/max month boundaries
  - Optional future month selection with allowFutureMonths prop
  - Configurable year range for picker
  - Disabled state for navigation buttons at boundaries
  - Full accessibility support with proper labels and states
  - Month utility functions (formatMonthLabel, shiftMonth, compareMonths, etc.)
  - Comprehensive test suite with 95%+ coverage
- Mobile: SharingScreen with expense sharing UI (#217)
  - Net balance summary showing overall settlements
  - View expenses shared by you with payment status tracking
  - View expenses shared with you by others
  - Pull-to-refresh functionality
  - Loading and error states
  - Empty state when no shared expenses exist
  - Integration with sharingStore for real-time data
  - Settlement balance display per contact
- API: GET /api/v1/sharing endpoint for retrieving all sharing data (#217)
  - Returns expenses shared by user
  - Returns expenses shared with user
  - Returns settlement balances with each contact
  - JWT authentication required
- API: PATCH /api/v1/sharing/[participantId]/paid endpoint (#217)
  - Allows expense owner to mark participant payments as received
  - Updates payment status and timestamp
  - JWT authentication required
- API: POST /api/v1/expenses/shares/[participantId]/decline endpoint (#186)
  - Allows participants to decline expense shares assigned to them
  - Optional decline reason field for explanation
  - Updates ExpenseParticipant status to DECLINED with timestamp
  - Authorization check ensures only assigned participant can decline
  - JWT authentication and active subscription required
- Mobile: EditTransactionScreen for editing and deleting transactions (#214)
  - Pre-populated form with existing transaction data
  - Transaction type toggle with visual feedback
  - Category selector filtered by transaction type
  - Date selector with quick options (Today, Yesterday, Custom)
  - Optional description field with character counter
  - Transaction preview showing updated values
  - Delete functionality with confirmation dialog
  - Loading and error states
  - Transaction not found state handling
  - Navigation wired from Dashboard and Transactions screens
  - Integration with PUT and DELETE transaction endpoints
- Mobile: BudgetsScreen with store integration and category list (#215)
  - Real budget data from budgets store
  - Category-specific budget cards with color indicators
  - Progress bars showing spent vs planned amounts
  - Month selector for navigating budget periods
  - Overall budget progress card
  - Pull-to-refresh functionality
  - Loading and error states
  - Empty state when no budgets exist
  - New BudgetCategoryCard component for displaying category budgets

- Mobile: sharingStore for expense splitting (#207)
  - Zustand store for managing shared expenses
  - Support for EQUAL, PERCENTAGE, and FIXED split types
  - Create, update, and delete shared expenses
  - Mark participant shares as paid or declined
  - List expenses shared by user and shared with user
  - Updates local cache after successful API mutations
  - Background refresh after mutations
  - Logout integration for state cleanup
  - 641-line comprehensive test suite with 90%+ coverage

