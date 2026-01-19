import { test, expect } from '@playwright/test'
import { LoginPage } from './pages/login-page'
import { DashboardPage } from './pages/dashboard-page'
import { TEST_USER_1, TEST_USER_2 } from './helpers/fixtures'

test.describe('authentication', () => {
  test.describe('login', () => {
    test('should successfully login with valid credentials', async ({ page }) => {
      const loginPage = new LoginPage(page)
      const dashboardPage = new DashboardPage(page)

      await loginPage.navigateToLogin()
      await loginPage.login(TEST_USER_1.email, TEST_USER_1.password)

      await expect(page.getByRole('heading', { name: /balance beacon/i })).toBeVisible()
      await dashboardPage.clickSignOut()
      await loginPage.expectLoginPage()
    })

    test('should show error message with invalid credentials', async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.navigateToLogin()
      await loginPage.login(TEST_USER_1.email, 'WrongPassword!')

      await loginPage.expectInvalidCredentialsError()
    })

    test('should show validation error for missing email', async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.navigateToLogin()
      await loginPage.fillPassword(TEST_USER_1.password)
      await loginPage.clickLogin()

      await expect(page.getByText(/enter a valid email address/i)).toBeVisible()
    })

    test('should show validation error for missing password', async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.navigateToLogin()
      await loginPage.fillEmail(TEST_USER_1.email)
      await loginPage.clickLogin()

      await expect(page.getByText(/password.*required/i)).toBeVisible()
    })

    test('should show validation error for invalid email format', async ({ page }) => {
      const loginPage = new LoginPage(page)

      await loginPage.navigateToLogin()
      await loginPage.fillEmail('not-an-email')
      await loginPage.fillPassword(TEST_USER_1.password)
      await loginPage.clickLogin()

      await expect(page.getByText(/valid.*email/i)).toBeVisible()
    })

    test('should redirect to dashboard if already logged in', async ({ page }) => {
      const loginPage = new LoginPage(page)
      const dashboardPage = new DashboardPage(page)

      await loginPage.navigateToLogin()
      await loginPage.login(TEST_USER_1.email, TEST_USER_1.password)
      await dashboardPage.waitForUrl(/\/?account=/)

      // Navigate to login page again - should redirect back to dashboard since already logged in
      await page.goto('/login')
      await dashboardPage.waitForUrl(/\/?account=/)

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('account switching', () => {
    test('User 1 can switch between personal and joint accounts', async ({ page }) => {
      const loginPage = new LoginPage(page)
      const dashboardPage = new DashboardPage(page)

      await loginPage.navigateToLogin()
      await loginPage.login(TEST_USER_1.email, TEST_USER_1.password)

      await expect(page.getByRole('heading', { name: /balance beacon/i })).toBeVisible()

      await dashboardPage.navigateToTab('Investments')
      await page.waitForLoadState('networkidle')

      const accountSelect = page.getByLabel('Account')
      await expect(accountSelect).toBeVisible()

      // User1 owns their personal account and the Joint account
      const options = await accountSelect.locator('option').allTextContents()
      expect(options).toContain(TEST_USER_1.displayName)
      expect(options).toContain('Joint')
      expect(options).not.toContain(TEST_USER_2.displayName)

      await dashboardPage.clickSignOut()
      await loginPage.expectLoginPage()
    })

    test('User 2 sees only their accounts in holdings tab', async ({ page }) => {
      const loginPage = new LoginPage(page)
      const dashboardPage = new DashboardPage(page)

      await loginPage.navigateToLogin()
      await loginPage.login(TEST_USER_2.email, TEST_USER_2.password)

      await expect(page.getByRole('heading', { name: /balance beacon/i })).toBeVisible()

      await dashboardPage.navigateToTab('Investments')
      await page.waitForLoadState('networkidle')

      const accountSelect2 = page.getByLabel('Account')
      await expect(accountSelect2).toBeVisible()

      // User2 should see their personal account but NOT User1's accounts
      // Note: Joint account is owned by User1 and not shared with User2 in seed data,
      // so User2 should not see the Joint account in their account list
      const options2 = await accountSelect2.locator('option').allTextContents()
      expect(options2).toContain(TEST_USER_2.displayName)
      expect(options2).not.toContain(TEST_USER_1.displayName)
      expect(options2).not.toContain('Joint')

      await dashboardPage.clickSignOut()
    })
  })

  test.describe('registration', () => {
    test('should show registration form', async ({ page }) => {
      await page.goto('/register')

      await expect(page.getByRole('heading', { name: /join balance beacon/i })).toBeVisible()
      await expect(page.getByLabel('Display name')).toBeVisible()
      await expect(page.getByLabel('Email')).toBeVisible()
      await expect(page.getByLabel('Password')).toBeVisible()
      await expect(page.getByRole('button', { name: /create account/i })).toBeVisible()
    })

    test('should show validation error for missing fields', async ({ page }) => {
      await page.goto('/register')
      await page.getByRole('button', { name: /create account/i }).click()

      await expect(page.getByText(/display name must be at least/i)).toBeVisible()
      await expect(page.getByText(/enter a valid email address/i)).toBeVisible()
      await expect(page.getByText(/password must be at least/i)).toBeVisible()
    })

    test('should show validation error for weak password', async ({ page }) => {
      await page.goto('/register')

      await page.getByLabel('Display name').fill('Test User')
      await page.getByLabel('Email').fill('test@example.com')
      await page.getByLabel('Password').fill('weak')
      await page.getByRole('button', { name: /create account/i }).click()

      await expect(page.getByText(/password.*at least/i)).toBeVisible()
    })

    test('should show link to login page', async ({ page }) => {
      await page.goto('/register')

      const loginLink = page.getByRole('link', { name: /sign in/i })
      await expect(loginLink).toBeVisible()
      await loginLink.click()

      await expect(page).toHaveURL(/\/login$/)
    })
  })

  test.describe('password reset', () => {
    test('should show forgot password option on login page', async ({ page }) => {
      await page.goto('/login')

      // The login page has a "Forgot password" tab button (not a link)
      const forgotButton = page.getByRole('button', { name: /forgot.*password/i })
      await expect(forgotButton).toBeVisible()
    })

    test('should show missing token message without token', async ({ page }) => {
      await page.goto('/reset-password')

      await expect(page.getByRole('heading', { name: /missing reset token/i })).toBeVisible()
      await expect(page.getByText(/no reset token provided/i)).toBeVisible()
      await expect(page.getByRole('link', { name: /go to sign in/i })).toBeVisible()
    })

    test('should show reset form with valid token', async ({ page }) => {
      await page.goto('/reset-password?token=fake-token-for-ui-test')

      await expect(page.getByRole('heading', { name: /set a new password/i })).toBeVisible()
      await expect(page.getByLabel(/new password/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /reset password/i })).toBeVisible()
    })
  })

  test.describe('session management', () => {
    test('should logout and clear session', async ({ page }) => {
      const loginPage = new LoginPage(page)
      const dashboardPage = new DashboardPage(page)

      await loginPage.navigateToLogin()
      await loginPage.login(TEST_USER_1.email, TEST_USER_1.password)
      await dashboardPage.waitForUrl(/\/?account=/)

      await dashboardPage.clickSignOut()
      await loginPage.expectLoginPage()

      await page.goto('/')
      await loginPage.expectLoginPage()
    })

    test('should persist session across page reloads', async ({ page }) => {
      const loginPage = new LoginPage(page)
      const dashboardPage = new DashboardPage(page)

      await loginPage.navigateToLogin()
      await loginPage.login(TEST_USER_1.email, TEST_USER_1.password)
      await dashboardPage.waitForUrl(/\/?account=/)

      await page.reload()
      await dashboardPage.waitForUrl(/\/?account=/)
      await expect(page.getByRole('heading', { name: /balance beacon/i })).toBeVisible()

      await dashboardPage.clickSignOut()
    })
  })
})
