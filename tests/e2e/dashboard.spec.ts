import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'

test.describe('dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('dashboard layout', () => {
    test('should display main dashboard elements', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      await dashboardPage.expectAccountOption('TestUserOne')
      await expect(page.getByLabel('Filter by account')).toBeVisible()
      await expect(page.getByLabel('Filter by month')).toBeVisible()

      await dashboardPage.clickSignOut()
    })

    test('should display stat cards', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      await expect(page.getByText(/total spent/i)).toBeVisible()
      await expect(page.getByText(/total earned/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })

    test('should display tabs', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      await dashboardPage.expectTab('Transactions')
      await dashboardPage.expectTab('Budgets')
      await dashboardPage.expectTab('Holdings')
      await dashboardPage.expectTab('Sharing')

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('month navigation', () => {
    test('should change month filter', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      const monthSelect = page.getByLabel('Filter by month')
      await expect(monthSelect).toBeVisible()

      const firstOption = await monthSelect.locator('option').first().textContent()
      if (firstOption) {
        await monthSelect.selectOption({ index: 0 })
        await page.waitForTimeout(500)
      }

      await dashboardPage.clickSignOut()
    })

    test('should persist month selection in URL', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      const monthSelect = page.getByLabel('Filter by month')
      const options = await monthSelect.locator('option').all()

      if (options.length > 1) {
        const monthValue = await options[1].getAttribute('value')
        if (monthValue) {
          await monthSelect.selectOption({ value: monthValue })
          await page.waitForTimeout(500)
          expect(page.url()).toContain(`month=${monthValue}`)
        }
      }

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('account navigation', () => {
    test('should switch between accounts', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      await dashboardPage.expectSelectedAccount('TestUserOne')

      await dashboardPage.selectAccount('Joint')
      await dashboardPage.expectAccountSwitchMessage('Joint')
      await dashboardPage.expectSelectedAccount('Joint')

      await dashboardPage.clickSignOut()
    })

    test('should persist account selection in URL', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      await dashboardPage.selectAccount('Joint')
      await page.waitForTimeout(500)

      expect(page.url()).toContain('account=')

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('navigation', () => {
    test('should navigate between tabs', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      await dashboardPage.navigateToTab('Budgets')
      await expect(page.getByRole('heading', { name: /budgets/i })).toBeVisible()

      await dashboardPage.navigateToTab('Holdings')
      await expect(page.getByText(/holdings/i)).toBeVisible()

      await dashboardPage.navigateToTab('Sharing')
      await expect(page.getByText(/settlement summary/i)).toBeVisible()

      await dashboardPage.navigateToTab('Transactions')
      await expect(page.getByRole('heading', { name: /transactions/i })).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })
})
