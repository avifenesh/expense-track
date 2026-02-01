/**
 * Transaction E2E Tests
 * Tests transaction CRUD operations with real backend
 */

import { device, element, by, expect, waitFor } from 'detox'
import { TestApiClient } from '../helpers/api-client'
import { TEST_USER, TIMEOUTS } from '../helpers/fixtures'
import { DashboardScreen, AddTransactionScreen, performLogin } from '../contracts/ui-contracts'

describe('Transaction E2E Tests', () => {
  let api: TestApiClient

  beforeAll(async () => {
    api = new TestApiClient()
    // Ensure test user exists and has data
    await api.ensureTestUser(TEST_USER, true)
    await api.setupTestData()
  })

  beforeEach(async () => {
    await device.launchApp({ newInstance: true })

    // Use performLogin which handles subscription loading state
    await performLogin(TEST_USER.email, TEST_USER.password)
  })

  describe('Dashboard', () => {
    it('displays dashboard with transactions', async () => {
      await expect(element(by.id('dashboard.screen'))).toBeVisible()
      await expect(element(by.id('dashboard.incomeAmount'))).toBeVisible()
      await expect(element(by.id('dashboard.expenseAmount'))).toBeVisible()
    })

    it('shows add transaction FAB', async () => {
      await expect(element(by.id('dashboard.addTransactionFab'))).toBeVisible()
    })
  })

  describe('Add Transaction', () => {
    it('opens add transaction screen from FAB', async () => {
      await DashboardScreen.tapAddTransaction()
      await AddTransactionScreen.waitForScreen()
      await expect(element(by.id('addTransaction.screen'))).toBeVisible()
    })

    it('displays all form elements', async () => {
      await DashboardScreen.tapAddTransaction()
      await AddTransactionScreen.waitForScreen()

      await expect(element(by.id('addTransaction.amountInput'))).toBeVisible()
      // Scroll within ScrollView to see description input (may be below fold)
      await waitFor(element(by.id('addTransaction.descriptionInput')))
        .toBeVisible()
        .whileElement(by.id('addTransaction.scrollView'))
        .scroll(200, 'down')
      await expect(element(by.id('addTransaction.descriptionInput'))).toBeVisible()
      // Submit button is in fixed footer, should be visible
      await expect(element(by.id('addTransaction.submitButton'))).toBeVisible()
    })

    it('creates expense transaction', async () => {
      const testDescription = `E2E Test ${Date.now()}`

      await DashboardScreen.tapAddTransaction()
      await AddTransactionScreen.waitForScreen()

      // Enter amount (enterAmount dismisses keyboard via tapReturnKey)
      await AddTransactionScreen.enterAmount('42.50')

      // Select a category (required field)
      await AddTransactionScreen.selectCategory('Groceries')

      // Enter description (enterDescription dismisses keyboard by tapping outside)
      await AddTransactionScreen.enterDescription(testDescription)

      // Submit (tapSubmit scrolls to button first)
      await AddTransactionScreen.tapSubmit()

      // Wait for navigation back to dashboard
      // Disable sync because app is busy with network requests (transaction refresh, toast)
      await device.disableSynchronization()
      try {
        await waitFor(element(by.id('dashboard.addTransactionFab')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.LONG)

        // Scroll down to see recent transactions section (may be below fold)
        await element(by.id('dashboard.scrollView')).scroll(300, 'down')

        // Transaction should appear in the list (expenses show as -$amount)
        await waitFor(element(by.text('-$42.50')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.MEDIUM)
      } finally {
        await device.enableSynchronization()
      }
    })
  })

  describe('Transaction List', () => {
    it('displays recent transactions on dashboard', async () => {
      // Dashboard should have transactions list
      // Disable sync as dashboard may be refreshing data
      await device.disableSynchronization()
      try {
        // Scroll down more to see the recent transactions section (below fold)
        // Use larger scroll value to ensure section is visible on all device sizes
        await element(by.id('dashboard.scrollView')).scroll(500, 'down')

        // Now check for the section (or its title as fallback)
        await waitFor(element(by.id('dashboard.recentTransactionsTitle')))
          .toBeVisible()
          .withTimeout(TIMEOUTS.MEDIUM)
      } finally {
        await device.enableSynchronization()
      }
    })

    it('taps on transaction to view details', async () => {
      // Get default account and transactions from the API
      const { accounts } = await api.getAccounts()
      if (accounts.length === 0) {
        return // No accounts - skip test
      }

      const defaultAccount = accounts[0]
      const result = await api.getTransactions(defaultAccount.id)
      if (result.transactions.length === 0) {
        return // No transactions - skip test
      }

      const transactionId = result.transactions[0].id
      await waitFor(element(by.id(`dashboard.transaction.${transactionId}`)))
        .toBeVisible()
        .whileScrolling(by.id('dashboard.scrollView'))
      await element(by.id(`dashboard.transaction.${transactionId}`)).tap()
      await waitFor(element(by.id('editTransaction.screen')))
        .toBeVisible()
        .withTimeout(TIMEOUTS.MEDIUM)
    })
  })

  describe('Month Navigation', () => {
    it('has month selector', async () => {
      await expect(element(by.id('dashboard.monthSelector'))).toBeVisible()
    })
  })
})
