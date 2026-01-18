# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

