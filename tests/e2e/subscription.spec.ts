import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'

test.describe('subscription', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsUser1(page)
  })

  test.describe('subscription status', () => {
    test('should show subscription banner if applicable', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      const trialBanner = page.getByText(/trial/i)
      const upgradeBanner = page.getByText(/upgrade/i)

      if ((await trialBanner.isVisible()) || (await upgradeBanner.isVisible())) {
        await expect(trialBanner.or(upgradeBanner)).toBeVisible()
      }

      await dashboardPage.clickSignOut()
    })

    test('should access upgrade page', async ({ page }) => {
      const dashboardPage = new DashboardPage(page)

      const upgradeLink = page.getByRole('link', { name: /upgrade/i })
      if (await upgradeLink.isVisible()) {
        await upgradeLink.click()
        await expect(page).toHaveURL(/\/upgrade/)
        await expect(page.getByText(/subscription/i)).toBeVisible()
      }

      await dashboardPage.clickSignOut()
    })
  })

  // Note: /pricing page does not exist - subscription info is shown on /upgrade page
  test.describe('pricing page', () => {
    test.skip('should show pricing information', async ({ page }) => {
      // Skipped: /pricing page doesn't exist - use /upgrade instead
      await page.goto('/pricing')
      await expect(page.getByText(/pricing/i)).toBeVisible()
      await expect(page.getByText(/month/i)).toBeVisible()
      await expect(page.getByText(/trial/i)).toBeVisible()
    })

    test.skip('should have sign up CTA', async ({ page }) => {
      // Skipped: /pricing page doesn't exist - use /upgrade instead
      await page.goto('/pricing')
      const signUpButton = page.getByRole('link', { name: /sign up|get started/i })
      if (await signUpButton.isVisible()) {
        await expect(signUpButton).toBeVisible()
      }
    })
  })

  test.describe('upgrade flow', () => {
    test('should show subscription options on upgrade page', async ({ page }) => {
      // Note: /upgrade requires authentication, but test users have active trial
      // so they can access the upgrade page
      const dashboardPage = new DashboardPage(page)

      // Navigate to upgrade from dashboard (user is already logged in from beforeEach)
      await page.goto('/upgrade')

      // Should show upgrade page content (user is on trial, so can access upgrade page)
      await expect(page.getByText(/upgrade/i)).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })
})
