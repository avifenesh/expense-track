import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'

// Note: Most onboarding tests require a user who hasn't completed onboarding.
// Our E2E seed data creates users with hasCompletedOnboarding: true, so users who
// access /onboarding are redirected to / (dashboard). These tests are skipped until
// we add a third test user without completed onboarding.

test.describe('onboarding', () => {
  test.describe('onboarding flow', () => {
    test.skip('should show onboarding wizard for new users', async ({ page }) => {
      // Skipped: Requires user without completed onboarding
      await page.goto('/onboarding')
      await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
    })

    test.skip('should skip onboarding and redirect to dashboard', async ({ page }) => {
      // Skipped: Requires user without completed onboarding
      await page.goto('/onboarding')
      const skipButton = page.getByRole('button', { name: /skip/i })
      await expect(skipButton).toBeVisible()
      await skipButton.click()
      await expect(page).toHaveURL(/\/?account=/)
    })
  })

  test.describe('onboarding wizard steps', () => {
    test.skip('should show welcome step', async ({ page }) => {
      // Skipped: Requires user without completed onboarding
      await page.goto('/onboarding')
      await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /get started/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /skip/i })).toBeVisible()
    })

    test.skip('should show currency selection step', async ({ page }) => {
      // Skipped: Requires user without completed onboarding
      await page.goto('/onboarding')
      const getStartedButton = page.getByRole('button', { name: /get started/i })
      await expect(getStartedButton).toBeVisible()
      await getStartedButton.click()
      await expect(page.getByText(/currency/i)).toBeVisible()
      await expect(page.getByRole('button', { name: 'USD' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'EUR' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'ILS' })).toBeVisible()
    })

    test.skip('should show categories creation step', async ({ page }) => {
      // Skipped: Requires user without completed onboarding
      await page.goto('/onboarding')
      const getStartedButton = page.getByRole('button', { name: /get started/i })
      await expect(getStartedButton).toBeVisible()
      await getStartedButton.click()
      const usdButton = page.getByRole('button', { name: 'USD' })
      await expect(usdButton).toBeVisible()
      await usdButton.click()
      await expect(page.getByText(/categories/i)).toBeVisible()
    })

    test.skip('should show progress indicator', async ({ page }) => {
      // Skipped: Requires user without completed onboarding
      await page.goto('/onboarding')
      const progressBar = page.getByRole('progressbar')
      await expect(progressBar).toBeVisible()
    })
  })

  test.describe('onboarding redirect', () => {
    test.skip('should redirect to onboarding if not completed', async ({ page }) => {
      // Skipped: Requires user without completed onboarding
      await page.goto('/')
      await expect(page).toHaveURL(/\/onboarding/)
      await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
    })

    test('should allow access to dashboard after onboarding completion', async ({ page }) => {
      await loginAsUser1(page)
      const dashboardPage = new DashboardPage(page)

      await dashboardPage.waitForUrl(/\/?account=/)
      await expect(page.getByRole('heading', { name: /balance beacon/i })).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })
})
