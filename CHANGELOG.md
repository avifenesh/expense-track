# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Mobile: AddTransactionScreen with comprehensive form for creating transactions (#213)
  - Type selector (Income/Expense) with visual feedback
  - Amount input with currency symbol display (USD, EUR, ILS)
  - Category selector with color-coded chips
  - Date selector with quick options (Today, Yesterday, Custom)
  - Optional description field with 200 character limit
  - Real-time form validation
  - Transaction preview before submission
  - FAB (Floating Action Button) on Dashboard and Transactions screens for quick access
- Mobile: Transaction validation utilities in `validation.ts`
  - Amount validation (required, positive, max 2 decimals, max value)
  - Description validation (optional, max 200 chars, XSS prevention)
  - Category validation (required)
  - Date validation (required, not future, within 10 years)
- Mobile: Modal presentation for AddTransactionScreen in navigation stack

### Changed
- Mobile: Updated AppStack navigation to include CreateTransaction modal route
- Mobile: Enhanced DashboardScreen with FAB for adding transactions
- Mobile: Enhanced TransactionsScreen with FAB for adding transactions

