import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'
import { RecurringPage } from './pages/recurring-page'
import { TEST_CATEGORIES } from './helpers/fixtures'

const getCurrentMonth = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

test.describe('recurring templates', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('template creation', () => {
    test('should create a recurring expense template', async ({ page }) => {
      const recurringPage = new RecurringPage(page)
      const dashboardPage = new DashboardPage(page)

      await recurringPage.navigateToRecurringTab()

      await recurringPage.fillRecurringForm({
        type: 'Expense',
        category: TEST_CATEGORIES.GROCERIES,
        amount: '250.00',
        startMonth: getCurrentMonth(),
        dayOfMonth: '15',
        description: 'Monthly grocery budget',
      })

      await recurringPage.submitRecurring()
      await expect(page.getByText(/recurring template saved/i)).toBeVisible({ timeout: 10000 })

      await page.reload()
      await page.waitForLoadState('networkidle')
      await recurringPage.navigateToRecurringTab()

      await recurringPage.expectTemplateInList(TEST_CATEGORIES.GROCERIES)

      await dashboardPage.clickSignOut()
    })

    test('should create a recurring income template', async ({ page }) => {
      const recurringPage = new RecurringPage(page)
      const dashboardPage = new DashboardPage(page)

      await recurringPage.navigateToRecurringTab()

      await recurringPage.fillRecurringForm({
        type: 'Income',
        category: TEST_CATEGORIES.SALARY,
        amount: '5000.00',
        startMonth: getCurrentMonth(),
        dayOfMonth: '1',
        description: 'Monthly salary',
      })

      await recurringPage.submitRecurring()
      await expect(page.getByText(/recurring template saved/i)).toBeVisible({ timeout: 10000 })

      await dashboardPage.clickSignOut()
    })

    test('should show validation error for missing amount', async ({ page }) => {
      const recurringPage = new RecurringPage(page)
      const dashboardPage = new DashboardPage(page)

      await recurringPage.navigateToRecurringTab()

      // Fill form without amount - the amount field has required attribute
      await recurringPage.fillRecurringForm({
        category: TEST_CATEGORIES.GROCERIES,
        amount: '',
        startMonth: getCurrentMonth(),
      })

      await recurringPage.submitRecurring()

      // HTML5 required validation should prevent submission
      await expect(page.getByText(/recurring template saved/i)).not.toBeVisible({ timeout: 2000 })

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('template management', () => {
    test('should pause and reactivate a template', async ({ page }) => {
      const recurringPage = new RecurringPage(page)
      const dashboardPage = new DashboardPage(page)

      await recurringPage.navigateToRecurringTab()

      // Create a template first
      await recurringPage.fillRecurringForm({
        category: TEST_CATEGORIES.UTILITIES,
        amount: '100.00',
        startMonth: getCurrentMonth(),
        description: 'E2E pause test',
      })
      await recurringPage.submitRecurring()
      await expect(page.getByText(/recurring template saved/i)).toBeVisible({ timeout: 10000 })

      await page.reload()
      await page.waitForLoadState('networkidle')
      await recurringPage.navigateToRecurringTab()

      // Pause the template
      await recurringPage.clickPauseTemplate(TEST_CATEGORIES.UTILITIES)
      await expect(page.getByText(/template paused/i)).toBeVisible({ timeout: 10000 })

      await page.reload()
      await page.waitForLoadState('networkidle')
      await recurringPage.navigateToRecurringTab()

      // Show paused templates
      await recurringPage.toggleShowPaused()

      // Reactivate
      await recurringPage.clickActivateTemplate(TEST_CATEGORIES.UTILITIES)
      await expect(page.getByText(/template re-activated/i)).toBeVisible({ timeout: 10000 })

      await dashboardPage.clickSignOut()
    })

    test('should apply templates this month', async ({ page }) => {
      const recurringPage = new RecurringPage(page)
      const dashboardPage = new DashboardPage(page)

      await recurringPage.navigateToRecurringTab()

      await recurringPage.clickApplyTemplatesThisMonth()

      // Should see a success message about items added or no new items
      await expect(
        page.getByText(/recurring item.*added|no new recurring items/i),
      ).toBeVisible({ timeout: 10000 })

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('template filtering', () => {
    test('should filter templates by type', async ({ page }) => {
      const recurringPage = new RecurringPage(page)
      const dashboardPage = new DashboardPage(page)

      await recurringPage.navigateToRecurringTab()
      await page.waitForLoadState('networkidle')

      await recurringPage.filterByType('Expense')
      await page.waitForLoadState('networkidle')

      await recurringPage.filterByType('Income')
      await page.waitForLoadState('networkidle')

      await recurringPage.filterByType('All types')
      await page.waitForLoadState('networkidle')

      await dashboardPage.clickSignOut()
    })

    test('should display template focus stats', async ({ page }) => {
      const recurringPage = new RecurringPage(page)
      const dashboardPage = new DashboardPage(page)

      await recurringPage.navigateToRecurringTab()
      await page.waitForLoadState('networkidle')

      // Verify stats panel elements are visible
      await expect(page.getByText('Active templates')).toBeVisible()
      await expect(page.getByText('Total monthly obligation')).toBeVisible()
      await expect(page.getByText('Expected recurring income')).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })
})
