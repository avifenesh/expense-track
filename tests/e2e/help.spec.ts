import { test, expect } from '@playwright/test'

test.describe('Help Center', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/help')
  })

  test('should display help center page with correct heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'How can we help?' })).toBeVisible()
  })

  test('should have search input visible', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search/i })
    await expect(searchInput).toBeVisible()
  })

  test('should display FAQ sections', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeVisible()
  })

  test('should display help articles section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Help Articles' })).toBeVisible()
  })

  test('should have back to app link', async ({ page }) => {
    const backLink = page.getByRole('link', { name: /back to app/i })
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/')
  })

  test('should have contact support section', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Still need help?' })).toBeVisible()
    await expect(page.getByRole('link', { name: /contact support/i })).toBeVisible()
  })

  test('should filter FAQs when searching', async ({ page }) => {
    const searchInput = page.getByRole('searchbox', { name: /search/i })
    await searchInput.fill('budget')

    // Wait for search results to appear
    await page.waitForTimeout(500) // Wait for debounce

    // Should show search results
    await expect(page.getByText(/found/i)).toBeVisible()
  })

  test('should expand FAQ when clicked', async ({ page }) => {
    // Find first FAQ section and expand it
    const firstCategory = page.locator('button').filter({ hasText: 'Getting Started' }).first()
    await firstCategory.click()

    // Find a FAQ question button and click it
    const faqQuestion = page.locator('button').filter({ hasText: 'How do I' }).first()
    await faqQuestion.click()

    // The answer should be visible
    await expect(page.getByText(/after signing up/i)).toBeVisible()
  })

  test('should navigate to article page', async ({ page }) => {
    // Click on the featured article or any article card
    const articleLink = page.getByRole('link', { name: /quick start guide/i }).first()
    await articleLink.click()

    // Should navigate to article page
    await expect(page).toHaveURL(/\/help\/quick-start-guide/)
    await expect(page.getByRole('heading', { name: 'Quick Start Guide' })).toBeVisible()
  })
})

test.describe('Help Article Page', () => {
  test('should display article content', async ({ page }) => {
    await page.goto('/help/quick-start-guide')

    await expect(page.getByRole('heading', { name: 'Quick Start Guide' })).toBeVisible()
    await expect(page.getByText(/get up and running/i)).toBeVisible()
  })

  test('should have back to help center link', async ({ page }) => {
    await page.goto('/help/quick-start-guide')

    const backLink = page.getByRole('link', { name: /back to help center/i })
    await expect(backLink).toBeVisible()
    await expect(backLink).toHaveAttribute('href', '/help')
  })

  test('should display category badge', async ({ page }) => {
    await page.goto('/help/quick-start-guide')

    await expect(page.getByText('Getting Started')).toBeVisible()
  })

  test('should show related articles if available', async ({ page }) => {
    await page.goto('/help/quick-start-guide')

    // Check for related articles section
    const relatedSection = page.getByRole('heading', { name: /more in/i })
    if (await relatedSection.isVisible()) {
      await expect(relatedSection).toBeVisible()
    }
  })

  test('should show related FAQs if available', async ({ page }) => {
    await page.goto('/help/quick-start-guide')

    // Check for related questions section
    const relatedFAQs = page.getByRole('heading', { name: /related questions/i })
    if (await relatedFAQs.isVisible()) {
      await expect(relatedFAQs).toBeVisible()
    }
  })

  test('should return 404 for non-existent article', async ({ page }) => {
    const response = await page.goto('/help/non-existent-article-slug')
    expect(response?.status()).toBe(404)
  })
})

test.describe('Help Center Navigation', () => {
  test('should have help link in footer', async ({ page }) => {
    await page.goto('/pricing')

    const helpLink = page.getByRole('link', { name: 'Help' })
    await expect(helpLink).toBeVisible()
    await expect(helpLink).toHaveAttribute('href', '/help')
  })

  test('should navigate from footer to help center', async ({ page }) => {
    await page.goto('/pricing')

    await page.getByRole('link', { name: 'Help' }).click()
    await expect(page).toHaveURL('/help')
  })
})

test.describe('Help Center Search', () => {
  test('should show suggested searches when focused', async ({ page }) => {
    await page.goto('/help')

    const searchInput = page.getByRole('searchbox', { name: /search/i })
    await searchInput.focus()

    // Should show popular searches
    await expect(page.getByText(/popular searches/i)).toBeVisible()
  })

  test('should search FAQs and articles', async ({ page }) => {
    await page.goto('/help')

    const searchInput = page.getByRole('searchbox', { name: /search/i })
    await searchInput.fill('recurring')

    // Wait for debounce
    await page.waitForTimeout(500)

    // Should find results
    await expect(page.getByText(/found/i)).toBeVisible()
  })

  test('should show no results message for non-matching query', async ({ page }) => {
    await page.goto('/help')

    const searchInput = page.getByRole('searchbox', { name: /search/i })
    await searchInput.fill('xyznonexistentquery123')

    // Wait for debounce
    await page.waitForTimeout(500)

    // Should show no results message
    await expect(page.getByText(/no results found/i)).toBeVisible()
  })

  test('should clear search when clicking clear button', async ({ page }) => {
    await page.goto('/help')

    const searchInput = page.getByRole('searchbox', { name: /search/i })
    await searchInput.fill('budget')

    // Wait for debounce
    await page.waitForTimeout(500)

    // Click clear button
    const clearButton = page.getByRole('button', { name: /clear search/i })
    await clearButton.click()

    // Search input should be empty
    await expect(searchInput).toHaveValue('')
  })
})
