import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'

test.describe('onboarding', () => {
  test.describe('onboarding redirect', () => {
    test('should allow access to dashboard after onboarding completion', async ({ page }) => {
      await loginAsUser1(page)
      const dashboardPage = new DashboardPage(page)

      await dashboardPage.waitForUrl(/\/?account=/)
      await expect(page.getByRole('heading', { name: /balance beacon/i })).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })
})
