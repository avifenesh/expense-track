import { test, expect } from '@playwright/test'

// E2E test users (must match .env.e2e configuration)
const USER1_EMAIL = 'e2e-user1@test.example.com'
const USER1_PASSWORD = 'Af!@#$56789'
const USER1_DISPLAY_NAME = 'TestUserOne'

const USER2_EMAIL = 'e2e-user2@test.example.com'
const USER2_PASSWORD = 'A76v38i61_7'
const USER2_DISPLAY_NAME = 'TestUserTwo'

test.describe('authentication experience', () => {
  test('User 1 can switch between personal and joint accounts', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Email').fill(USER1_EMAIL)
    await page.getByLabel('Password').fill(USER1_PASSWORD)

    await page.getByRole('button', { name: 'Enter Balance Beacon' }).click()

    await expect(page).toHaveURL(/\/?account=/)
    const dashboardAccountSelect = page.getByLabel('Filter by account')
    await expect(dashboardAccountSelect.locator('option', { hasText: USER1_DISPLAY_NAME })).toHaveCount(1)
    await expect(dashboardAccountSelect.locator('option', { hasText: 'Joint' })).toHaveCount(1)
    await expect(dashboardAccountSelect.locator('option', { hasText: USER2_DISPLAY_NAME })).toHaveCount(0)

    await expect(dashboardAccountSelect.locator('option:checked')).toHaveText(USER1_DISPLAY_NAME)

    await dashboardAccountSelect.selectOption({ label: 'Joint' })
    await expect(page.getByText('Joint will open by default next time.')).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('User 2 sees only their accounts and invalid logins show a message', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill(USER2_EMAIL)
    await page.getByLabel('Password').fill('WrongPassword!')
    await page.getByRole('button', { name: 'Enter Balance Beacon' }).click()

    await expect(page.getByText('Invalid username or password')).toBeVisible()

    await page.getByLabel('Email').fill(USER2_EMAIL)
    await page.getByLabel('Password').fill(USER2_PASSWORD)
    await page.getByRole('button', { name: 'Enter Balance Beacon' }).click()

    const accountSelect = page.getByLabel('Filter by account')
    await expect(accountSelect.locator('option', { hasText: USER2_DISPLAY_NAME })).toHaveCount(1)
    await expect(accountSelect.locator('option', { hasText: 'Joint' })).toHaveCount(1)
    await expect(accountSelect.locator('option', { hasText: USER1_DISPLAY_NAME })).toHaveCount(0)

    await page.getByRole('button', { name: 'Sign out' }).click()
  })
})
