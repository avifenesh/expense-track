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

      await expect(page.getByText(/settlement summary/i)).toBeVisible()

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

      const shareButton = page.getByRole('button', { name: /share/i }).first()
      await expect(shareButton).toBeVisible()
      await shareButton.click()

      await sharingPage.fillShareExpenseForm({
        splitType: 'Split equally',
        participantEmails: [TEST_USER_2.email],
      })

      await sharingPage.submitShareExpense()

      await expect(page.getByText(/expense shared/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })

    test('should show validation error for empty participants', async ({ page }) => {
      const transactionsPage = new TransactionsPage(page)
      const dashboardPage = new DashboardPage(page)

      await transactionsPage.navigateToTransactionsTab()

      await transactionsPage.fillTransactionForm({
        category: TEST_CATEGORIES.RENT,
        amount: '1000.00',
        date: getToday(),
        description: 'Monthly rent',
      })

      await transactionsPage.submitTransaction()

      const shareButton = page.getByRole('button', { name: /share/i }).first()
      await expect(shareButton).toBeVisible()
      await shareButton.click()

      const submitButton = page.getByRole('button', { name: /share expense/i })
      await submitButton.click()

      await expect(page.getByText(/add.*participant/i)).toBeVisible()

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

      const shareButton = page.getByRole('button', { name: /share/i }).first()
      await expect(shareButton).toBeVisible()
      await shareButton.click()

      const emailInput = page.getByPlaceholder('Enter email address')
      await emailInput.fill(TEST_USER_2.email)
      const addButton = page.getByRole('button', { name: 'Add participant' })
      await addButton.click()

      await sharingPage.expectParticipantAdded(TEST_USER_2.email)

      const removeButton = page.getByRole('button', { name: 'Remove participant' }).first()
      await expect(removeButton).toBeVisible()
      await removeButton.click()
      await expect(page.getByText(TEST_USER_2.email)).not.toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('expense requests', () => {
    test('should view shared expenses list', async ({ page }) => {
      const sharingPage = new SharingPage(page)
      const dashboardPage = new DashboardPage(page)

      await sharingPage.navigateToSharingTab()

      await expect(page.getByText(/expenses i shared/i)).toBeVisible()
      await expect(page.getByText(/expenses shared with me/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })

    test('should show settlement balances', async ({ page }) => {
      const sharingPage = new SharingPage(page)
      const dashboardPage = new DashboardPage(page)

      await sharingPage.navigateToSharingTab()

      const settlementSection = page.locator('div', { hasText: /settlement summary/i })
      await expect(settlementSection).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })
})
