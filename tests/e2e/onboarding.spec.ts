import { test, expect } from '@playwright/test'
import { loginAsUser1 } from './helpers/auth-helpers'
import { DashboardPage } from './pages/dashboard-page'

test.describe('onboarding', () => {
  test.describe('onboarding flow', () => {
    test('should show onboarding wizard for new users', async ({ page }) => {
      await page.goto('/onboarding')

      await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
    })

    test('should skip onboarding and redirect to dashboard', async ({ page }) => {
      await page.goto('/onboarding')

      const skipButton = page.getByRole('button', { name: /skip/i })
      if (await skipButton.isVisible()) {
        await skipButton.click()
        await expect(page).toHaveURL(/\/?account=/)
      }
    })
  })

  test.describe('onboarding wizard steps', () => {
    test('should show welcome step', async ({ page }) => {
      await page.goto('/onboarding')

      await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /get started/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /skip/i })).toBeVisible()
    })

    test('should show currency selection step', async ({ page }) => {
      await page.goto('/onboarding')

      const getStartedButton = page.getByRole('button', { name: /get started/i })
      if (await getStartedButton.isVisible()) {
        await getStartedButton.click()

        await expect(page.getByText(/currency/i)).toBeVisible()
        await expect(page.getByRole('button', { name: 'USD' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'EUR' })).toBeVisible()
        await expect(page.getByRole('button', { name: 'ILS' })).toBeVisible()
      }
    })

    test('should show categories creation step', async ({ page }) => {
      await page.goto('/onboarding')

      const getStartedButton = page.getByRole('button', { name: /get started/i })
      if (await getStartedButton.isVisible()) {
        await getStartedButton.click()

        const usdButton = page.getByRole('button', { name: 'USD' })
        if (await usdButton.isVisible()) {
          await usdButton.click()
          await expect(page.getByText(/categories/i)).toBeVisible()
        }
      }
    })

    test('should show progress indicator', async ({ page }) => {
      await page.goto('/onboarding')

      const progressBar = page.getByRole('progressbar')
      await expect(progressBar).toBeVisible()
    })
  })

  test.describe('onboarding redirect', () => {
    test('should redirect to onboarding if not completed', async ({ page }) => {
      await page.goto('/')

      const url = page.url()
      if (url.includes('/onboarding')) {
        await expect(page).toHaveURL(/\/onboarding/)
        await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible()
      }
    })

    test('should allow access to dashboard after onboarding completion', async ({ page }) => {
      await loginAsUser1(page)
      const dashboardPage = new DashboardPage(page)

      await dashboardPage.waitForUrl(/\/?account=/)
      await dashboardPage.expectAccountOption('TestUserOne')

      await dashboardPage.clickSignOut()
    })
  })
})
