# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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
