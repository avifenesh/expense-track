import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'
import { TransactionsPage } from './pages/transactions-page'
import { TEST_CATEGORIES, getToday } from './helpers/fixtures'

test.describe('transactions', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('transaction creation', () => {
    test('should create a new expense transaction', async ({ page }) => {
      const transactionsPage = new TransactionsPage(page)
      const dashboardPage = new DashboardPage(page)

      await transactionsPage.navigateToTransactionsTab()
      await transactionsPage.expectTransactionForm()

      await transactionsPage.fillTransactionForm({
        category: TEST_CATEGORIES.GROCERIES,
        amount: '50.00',
        date: getToday(),
        description: 'Weekly groceries',
      })

      await transactionsPage.submitTransaction()

      await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 10000 })
      // Reload page to ensure fresh data (optimistic updates can cause timing issues)
      await page.reload()
      await page.waitForLoadState('networkidle')
      // Navigate back to transactions tab after reload
      await transactionsPage.navigateToTransactionsTab()
      await transactionsPage.expectTransactionInList('Weekly groceries', '50.00')

      await dashboardPage.clickSignOut()
    })

    test('should create a new income transaction', async ({ page }) => {
      const transactionsPage = new TransactionsPage(page)
      const dashboardPage = new DashboardPage(page)

      await transactionsPage.navigateToTransactionsTab()

      await transactionsPage.fillTransactionForm({
        type: 'Income',
        category: TEST_CATEGORIES.SALARY,
        amount: '3000.00',
        date: getToday(),
        description: 'Monthly salary',
      })

      await transactionsPage.submitTransaction()

      await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 10000 })
      // Reload page to ensure fresh data (optimistic updates can cause timing issues)
      await page.reload()
      await page.waitForLoadState('networkidle')
      // Navigate back to transactions tab after reload
      await transactionsPage.navigateToTransactionsTab()
      await transactionsPage.expectTransactionInList('Monthly salary', '3000.00')

      await dashboardPage.clickSignOut()
    })

    test('should show validation error for invalid amount', async ({ page }) => {
      const transactionsPage = new TransactionsPage(page)
      const dashboardPage = new DashboardPage(page)

      await transactionsPage.navigateToTransactionsTab()

      await transactionsPage.fillTransactionForm({
        category: TEST_CATEGORIES.GROCERIES,
        amount: '-50',
        date: getToday(),
      })

      await transactionsPage.submitTransaction()

      await transactionsPage.expectValidationError(/greater than zero/i)

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('transaction editing', () => {
    test('should edit an existing transaction', async ({ page }) => {
      const transactionsPage = new TransactionsPage(page)
      const dashboardPage = new DashboardPage(page)

      await transactionsPage.navigateToTransactionsTab()

      await transactionsPage.fillTransactionForm({
        category: TEST_CATEGORIES.ENTERTAINMENT,
        amount: '25.00',
        date: getToday(),
        description: 'Movie tickets',
      })

      await transactionsPage.submitTransaction()

      // Wait for transaction saved toast before looking for edit button
      await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 10000 })
      // Reload page to ensure fresh data (optimistic updates can cause timing issues)
      await page.reload()
      await page.waitForLoadState('networkidle')
      // Navigate back to transactions tab after reload
      await transactionsPage.navigateToTransactionsTab()

      await transactionsPage.clickEditTransaction('Movie tickets')

      await page.getByLabel('Amount').fill('30.00')
      await page.getByRole('button', { name: /update|save/i }).click()

      await expect(page.getByText(/transaction updated/i)).toBeVisible()
      await transactionsPage.expectTransactionInList('Movie tickets', '30.00')

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('transaction deletion', () => {
    test('should delete a transaction', async ({ page }) => {
      const transactionsPage = new TransactionsPage(page)
      const dashboardPage = new DashboardPage(page)

      await transactionsPage.navigateToTransactionsTab()

      await transactionsPage.fillTransactionForm({
        category: TEST_CATEGORIES.UTILITIES,
        amount: '75.00',
        date: getToday(),
        description: 'Electric bill',
      })

      await transactionsPage.submitTransaction()

      // Wait for transaction saved toast before looking for delete button
      await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 10000 })
      // Reload page to ensure fresh data (optimistic updates can cause timing issues)
      await page.reload()
      await page.waitForLoadState('networkidle')
      // Navigate back to transactions tab after reload
      await transactionsPage.navigateToTransactionsTab()

      // Transaction deletion is immediate (no confirmation dialog)
      await transactionsPage.clickDeleteTransaction('Electric bill')

      await expect(page.getByText(/transaction removed/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('transaction filtering', () => {
    test('should filter transactions by type', async ({ page }) => {
      const transactionsPage = new TransactionsPage(page)
      const dashboardPage = new DashboardPage(page)

      await transactionsPage.navigateToTransactionsTab()
      await page.waitForLoadState('networkidle')

      const filterSelect = page.getByLabel('Type filter')
      await expect(filterSelect).toBeVisible()

      await transactionsPage.filterByType('Expense')
      await page.waitForLoadState('networkidle')

      await transactionsPage.filterByType('Income')
      await page.waitForLoadState('networkidle')

      // The "All" option label is "All types"
      await transactionsPage.filterByType('All types')
      await page.waitForLoadState('networkidle')

      await dashboardPage.clickSignOut()
    })

    test('should search transactions by description', async ({ page }) => {
      const transactionsPage = new TransactionsPage(page)
      const dashboardPage = new DashboardPage(page)

      await transactionsPage.navigateToTransactionsTab()
      await page.waitForLoadState('networkidle')

      const searchInput = page.getByLabel('Search')
      await expect(searchInput).toBeVisible()
      await transactionsPage.searchTransactions('grocery')
      await page.waitForLoadState('networkidle')

      await dashboardPage.clickSignOut()
    })
  })
})
