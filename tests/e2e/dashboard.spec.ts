import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'

test.describe('dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('dashboard layout', () => {
    test('should display main dashboard elements', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /balance beacon/i })).toBeVisible()
      await expect(page.getByText(/financial clarity/i)).toBeVisible()

      await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /transactions/i })).toBeVisible()
    })

    test('should display stat cards', async ({ page }) => {
      await page.waitForLoadState('networkidle')

      const statCards = page.getByTestId('stat-card')
      await expect(statCards.first()).toBeVisible()
    })

    test('should display tabs', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      await dashboardPage.expectTab('Overview')
      await dashboardPage.expectTab('Transactions')
      await dashboardPage.expectTab('Budgets')
      await dashboardPage.expectTab('Auto-repeat')
      await dashboardPage.expectTab('Labels')
      await dashboardPage.expectTab('Investments')
      await dashboardPage.expectTab('Sharing')
    })
  })

  test.describe('month navigation', () => {
    test('should navigate to previous month', async ({ page }) => {
      const prevButton = page.getByRole('button', { name: 'Previous month' })
      await expect(prevButton).toBeVisible()

      const currentUrl = page.url()
      await prevButton.click()

      // Wait for URL to change (client-side navigation adds month param)
      await page.waitForURL((url) => url.toString() !== currentUrl)

      const newUrl = page.url()
      expect(newUrl).not.toBe(currentUrl)
      expect(newUrl).toContain('month=')
    })

    test('should navigate to next month', async ({ page }) => {
      const nextButton = page.getByRole('button', { name: 'Next month' })
      await expect(nextButton).toBeVisible()

      const currentUrl = page.url()
      await nextButton.click()

      // Wait for URL to change (client-side navigation adds month param)
      await page.waitForURL((url) => url.toString() !== currentUrl)

      const newUrl = page.url()
      expect(newUrl).not.toBe(currentUrl)
      expect(newUrl).toContain('month=')
    })

    test('should display current month label', async ({ page }) => {
      const monthLabel = page.getByTestId('month-label')
      await expect(monthLabel).toBeVisible()
      await expect(monthLabel).toContainText(/\w+ \d{4}/)
    })
  })

  test.describe('account navigation in holdings tab', () => {
    test('should switch between accounts in holdings tab', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      await dashboardPage.navigateToTab('Investments')
      await page.waitForLoadState('networkidle')

      const accountSelect = page.getByLabel('Account')
      await expect(accountSelect).toBeVisible()

      const options = await accountSelect.locator('option').all()
      if (options.length > 1) {
        const firstOptionValue = await options[1].getAttribute('value')
        if (firstOptionValue) {
          await accountSelect.selectOption(firstOptionValue)
          await page.waitForLoadState('networkidle')
        }
      }
    })
  })

  test.describe('navigation', () => {
    test('should navigate between tabs', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      await dashboardPage.navigateToTab('Budgets')
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('heading', { name: /budgets/i })).toBeVisible()

      await dashboardPage.navigateToTab('Investments')
      await page.waitForLoadState('networkidle')
      await expect(page.getByText(/holdings/i)).toBeVisible()

      await dashboardPage.navigateToTab('Sharing')
      await page.waitForLoadState('networkidle')
      await expect(page.getByText(/expenses you shared/i)).toBeVisible()

      await dashboardPage.navigateToTab('Transactions')
      await page.waitForLoadState('networkidle')
      await expect(page.getByRole('heading', { name: /transactions/i })).toBeVisible()
    })

    test('should navigate to Overview tab', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      await dashboardPage.navigateToTab('Budgets')
      await page.waitForLoadState('networkidle')

      await dashboardPage.navigateToTab('Overview')
      await page.waitForLoadState('networkidle')
      await expect(page.getByText(/cashflow snapshot/i)).toBeVisible()
    })
  })
})
