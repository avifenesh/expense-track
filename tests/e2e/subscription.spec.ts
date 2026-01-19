import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'

test.describe('subscription', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('upgrade flow', () => {
    test('should show upgrade page content', async ({ page }) => {
      await page.goto('/upgrade')

      // Should show upgrade page content (test user is on trial)
      await expect(page.getByText(/upgrade/i)).toBeVisible()

      // Navigate back to dashboard to sign out
      await page.goto('/')
      const dashboardPage = new DashboardPage(page)
      await dashboardPage.clickSignOut()
    })
  })
})
