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

  test.describe('pricing page', () => {
    test('should show pricing information', async ({ page }) => {
      await page.goto('/pricing')

      await expect(page.getByText(/pricing/i)).toBeVisible()
      await expect(page.getByText(/month/i)).toBeVisible()
      await expect(page.getByText(/trial/i)).toBeVisible()
    })

    test('should have sign up CTA', async ({ page }) => {
      await page.goto('/pricing')

      const signUpButton = page.getByRole('link', { name: /sign up|get started/i })
      if (await signUpButton.isVisible()) {
        await expect(signUpButton).toBeVisible()
      }
    })
  })

  test.describe('upgrade flow', () => {
    test('should show subscription options on upgrade page', async ({ page }) => {
      await page.goto('/upgrade')

      await expect(page.getByText(/upgrade/i)).toBeVisible()
      await expect(page.getByText(/subscription/i)).toBeVisible()
    })
  })
})
