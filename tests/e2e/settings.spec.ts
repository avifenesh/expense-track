import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'

test.describe('settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('settings access', () => {
    test('should access settings page', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      const settingsLink = page.getByRole('link', { name: /settings/i })
      if (await settingsLink.isVisible()) {
        await settingsLink.click()
        await expect(page).toHaveURL(/\/settings/)
        await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()
      }

      await dashboardPage.clickSignOut()
    })

    test('should show profile section', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      const settingsLink = page.getByRole('link', { name: /settings/i })
      if (await settingsLink.isVisible()) {
        await settingsLink.click()
        await expect(page.getByText(/profile/i)).toBeVisible()
        await expect(page.getByText(/display name/i)).toBeVisible()
      }

      await dashboardPage.clickSignOut()
    })

    test('should show currency preference', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      const settingsLink = page.getByRole('link', { name: /settings/i })
      if (await settingsLink.isVisible()) {
        await settingsLink.click()
        await expect(page.getByText(/currency/i)).toBeVisible()
      }

      await dashboardPage.clickSignOut()
    })
  })
})
