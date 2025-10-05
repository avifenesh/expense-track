import { test, expect } from '@playwright/test'

const AVI_EMAIL = 'aviarchi1994@gmail.com'
const AVI_PASSWORD = 'Af!@#$56789'
const SERENA_EMAIL = 'serena.bianchi@hotmail.it'
const SERENA_PASSWORD = 'A76v38i61_7'

test.describe('authentication experience', () => {
  test('Avi can switch between personal and joint accounts', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Email').fill(AVI_EMAIL)
    await page.getByLabel('Password').fill(AVI_PASSWORD)

    await page.getByRole('button', { name: 'Enter Balance Beacon' }).click()

    await expect(page).toHaveURL(/\/?account=/)
    const dashboardAccountSelect = page.getByLabel('Filter by account')
    await expect(dashboardAccountSelect.locator('option', { hasText: 'Avi' })).toHaveCount(1)
    await expect(dashboardAccountSelect.locator('option', { hasText: 'Joint' })).toHaveCount(1)
    await expect(dashboardAccountSelect.locator('option', { hasText: 'Serena' })).toHaveCount(0)

    await expect.poll(async () => {
      return dashboardAccountSelect.evaluate((select) => select.options[select.selectedIndex]?.textContent?.trim())
    }).toBe('Avi')

    await dashboardAccountSelect.selectOption({ label: 'Joint' })
    await expect(page.getByText('Joint will open by default next time.')).toBeVisible()

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('Serena sees only her accounts and invalid logins show a message', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Email').fill(SERENA_EMAIL)
    await page.getByLabel('Password').fill('WrongPassword!')
    await page.getByRole('button', { name: 'Enter Balance Beacon' }).click()

    await expect(page.getByText('Invalid username or password')).toBeVisible()

    await page.getByLabel('Email').fill(SERENA_EMAIL)
    await page.getByLabel('Password').fill(SERENA_PASSWORD)
    await page.getByRole('button', { name: 'Enter Balance Beacon' }).click()

    const accountSelect = page.getByLabel('Filter by account')
    await expect(accountSelect.locator('option', { hasText: 'Serena' })).toHaveCount(1)
    await expect(accountSelect.locator('option', { hasText: 'Joint' })).toHaveCount(1)
    await expect(accountSelect.locator('option', { hasText: 'Avi' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Sign out' }).click()
  })
})
