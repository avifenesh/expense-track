import { test, expect } from '@playwright/test'

test.describe('pricing page', () => {
  test.describe('public access', () => {
    test('should load pricing page without authentication', async ({ page }) => {
      await page.goto('/pricing')

      await expect(page).toHaveURL(/\/pricing/)

      await expect(page.getByRole('heading', { name: /one plan.*everything included/i })).toBeVisible()
    })

    test('should display correct pricing', async ({ page }) => {
      await page.goto('/pricing')

      const mainPrice = page.getByText('$3').filter({ hasText: '/month' })
      await expect(mainPrice).toBeVisible()

      await expect(page.getByText(/14.*day.*free.*trial/i)).toBeVisible()
    })

    test('should show comparison table', async ({ page }) => {
      await page.goto('/pricing')

      await expect(page.getByRole('heading', { name: /free trial vs premium/i })).toBeVisible()

      await expect(page.getByText('Free Trial').first()).toBeVisible()
      await expect(page.getByText('Premium').first()).toBeVisible()

      await expect(page.getByText('Transaction tracking')).toBeVisible()
      await expect(page.getByText('Budget tracking')).toBeVisible()
      await expect(page.getByText('Priority support')).toBeVisible()

      await expect(page.getByText('Limited (50)')).toBeVisible()
      await expect(page.getByText('Unlimited')).toBeVisible()
    })

    test('should have CTA button linking to register', async ({ page }) => {
      await page.goto('/pricing')

      const ctaButton = page.getByRole('link', { name: /start free trial/i })
      await expect(ctaButton).toBeVisible()
      await expect(ctaButton).toHaveAttribute('href', '/register')
    })

    test('should show money-back guarantee', async ({ page }) => {
      await page.goto('/pricing')

      await expect(page.getByText(/30.*day.*money.*back.*guarantee/i)).toBeVisible()
    })

    test('should have back navigation link', async ({ page }) => {
      await page.goto('/pricing')

      const backLink = page.getByRole('link', { name: /back to app/i })
      await expect(backLink).toBeVisible()
      await expect(backLink).toHaveAttribute('href', '/')
    })

    test('should show footer with links', async ({ page }) => {
      await page.goto('/pricing')

      await expect(page.getByRole('link', { name: /privacy/i })).toBeVisible()
      await expect(page.getByRole('link', { name: /terms/i })).toBeVisible()
    })

    test('should show contact email', async ({ page }) => {
      await page.goto('/pricing')

      await expect(page.getByRole('link', { name: /support@balancebeacon\.app/i })).toBeVisible()
    })
  })

  test.describe('navigation', () => {
    test('should navigate to register from CTA', async ({ page }) => {
      await page.goto('/pricing')

      await page.getByRole('link', { name: /start free trial/i }).click()
      await expect(page).toHaveURL(/\/register/)
    })

    test('should navigate back to app from back link', async ({ page }) => {
      await page.goto('/pricing')

      await page.getByRole('link', { name: /back to app/i }).click()
      await expect(page).toHaveURL(/^\/$|\/login/)
    })
  })
})
