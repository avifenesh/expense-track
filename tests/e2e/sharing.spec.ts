import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'
import { SharingPage } from './pages/sharing-page'
import { TransactionsPage } from './pages/transactions-page'
import { TEST_USER_2, TEST_CATEGORIES, getToday } from './helpers/fixtures'

test.describe('sharing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('expense sharing', () => {
    test('should show sharing tab', async ({ page }) => {
      const sharingPage = new SharingPage(page)
      const dashboardPage = new DashboardPage(page)

      await sharingPage.navigateToSharingTab()

      await expect(page.getByText(/expenses you shared/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })

    test('should share an expense with equal split', async ({ page }) => {
      const transactionsPage = new TransactionsPage(page)
      const sharingPage = new SharingPage(page)
      const dashboardPage = new DashboardPage(page)

      await transactionsPage.navigateToTransactionsTab()

      await transactionsPage.fillTransactionForm({
        category: TEST_CATEGORIES.GROCERIES,
        amount: '100.00',
        date: getToday(),
        description: 'Shared groceries',
      })

      await transactionsPage.submitTransaction()

      // Wait for transaction saved toast before looking for share button
      await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 10000 })
      // Reload page to ensure fresh data (optimistic updates can cause timing issues)
      await page.reload()
      await page.waitForTimeout(1000)
      // Navigate back to transactions tab after reload
      await transactionsPage.navigateToTransactionsTab()

      // Find the share button for the newly created transaction
      // Use getByRole for the share button directly - it's more reliable than nested locators
      // The button has title="Share expense" which translates to accessible name
      const shareButton = page.getByRole('button', { name: 'Share expense' }).first()
      await expect(shareButton).toBeVisible({ timeout: 10000 })
      await shareButton.click()
      // Wait for share expense form to mount and CSRF token to load
      await page.waitForSelector('[placeholder="Enter email address"]', { state: 'visible' })
      await page.waitForTimeout(1000)

      await sharingPage.fillShareExpenseForm({
        splitType: 'Split equally',
        participantEmails: [TEST_USER_2.email],
      })

      await sharingPage.submitShareExpense()

      await expect(page.getByText(/expense shared/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })

    test('should add and remove participants', async ({ page }) => {
      const transactionsPage = new TransactionsPage(page)
      const sharingPage = new SharingPage(page)
      const dashboardPage = new DashboardPage(page)

      await transactionsPage.navigateToTransactionsTab()

      await transactionsPage.fillTransactionForm({
        category: TEST_CATEGORIES.ENTERTAINMENT,
        amount: '60.00',
        date: getToday(),
        description: 'Concert tickets',
      })

      await transactionsPage.submitTransaction()

      // Wait for transaction saved toast before looking for share button
      await expect(page.getByText(/transaction saved/i)).toBeVisible({ timeout: 10000 })
      // Reload page to ensure fresh data (optimistic updates can cause timing issues)
      await page.reload()
      await page.waitForTimeout(1000)
      // Navigate back to transactions tab after reload
      await transactionsPage.navigateToTransactionsTab()

      // Find the share button for the newly created transaction
      // Use getByRole for the share button directly - it's more reliable than nested locators
      // The button has title="Share expense" which translates to accessible name
      const shareButton = page.getByRole('button', { name: 'Share expense' }).first()
      await expect(shareButton).toBeVisible({ timeout: 10000 })
      await shareButton.click()
      // Wait for share expense form to mount and CSRF token to load
      await page.waitForSelector('[placeholder="Enter email address"]', { state: 'visible' })
      await page.waitForTimeout(1000)

      // Add participant (aria-label="Add participant")
      const emailInput = page.getByPlaceholder('Enter email address')
      await emailInput.fill(TEST_USER_2.email)
      const addButton = page.getByLabel('Add participant')
      await addButton.click()
      // Wait for participant lookup (async server action) to complete
      await page.waitForTimeout(1000)

      await sharingPage.expectParticipantAdded(TEST_USER_2.email)

      // Remove participant (aria-label="Remove participant")
      const removeButton = page.getByLabel('Remove participant').first()
      await expect(removeButton).toBeVisible({ timeout: 10000 })
      await removeButton.click()
      await expect(page.getByText(TEST_USER_2.email)).not.toBeVisible()

      // Close the share dialog before signing out (dialog backdrop blocks other elements)
      const cancelButton = page.getByRole('button', { name: /cancel/i })
      await cancelButton.click()

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('expense requests', () => {
    test('should view shared expenses list', async ({ page }) => {
      const sharingPage = new SharingPage(page)
      const dashboardPage = new DashboardPage(page)

      await sharingPage.navigateToSharingTab()

      await expect(page.getByText(/expenses you shared/i)).toBeVisible()
      await expect(page.getByText(/expenses shared with you/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })
})
