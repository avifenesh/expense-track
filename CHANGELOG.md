# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
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

