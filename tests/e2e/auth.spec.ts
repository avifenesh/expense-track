import { test, expect } from '@playwright/test'

const USERNAME = 'balance-director'
const PASSWORD = 'Balance2025!'
const ACCOUNT_LABEL = 'Joint'

test.describe('authentication experience', () => {
  test('signs in, persists the account, and signs out', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Username').fill(USERNAME)
    await page.getByLabel('Password').fill(PASSWORD)
    await page.getByLabel('Work on account').selectOption({ label: ACCOUNT_LABEL })

    const selectedAccountId = await page.getByLabel('Work on account').inputValue()

    await page.getByRole('button', { name: 'Enter Balance Beacon' }).click()

    await expect(page).toHaveURL(/\/?account=/)
    const dashboardAccountSelect = page.getByLabel('Filter by account')
    await expect(dashboardAccountSelect).toHaveValue(selectedAccountId)

    await page.reload()
    await expect(dashboardAccountSelect).toHaveValue(selectedAccountId)

    await page.getByRole('button', { name: 'Sign out' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test('surfaces a helpful message on invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.getByLabel('Username').fill(USERNAME)
    await page.getByLabel('Password').fill('WrongPassword!')
    await page.getByRole('button', { name: 'Enter Balance Beacon' }).click()

    await expect(page.getByText('Invalid username or password')).toBeVisible()
  })
})
