import { Page } from '@playwright/test'
import { LoginPage } from '../pages/login-page'
import { TEST_USER_1, TEST_USER_2 } from './fixtures'

export async function loginAsUser1(page: Page) {
  const loginPage = new LoginPage(page)
  await loginPage.navigateToLogin()
  await loginPage.login(TEST_USER_1.email, TEST_USER_1.password)
  await loginPage.waitForUrl(/\/?account=/)
}

export async function loginAsUser2(page: Page) {
  const loginPage = new LoginPage(page)
  await loginPage.navigateToLogin()
  await loginPage.login(TEST_USER_2.email, TEST_USER_2.password)
  await loginPage.waitForUrl(/\/?account=/)
}

export async function loginAsUser(page: Page, email: string, password: string) {
  const loginPage = new LoginPage(page)
  await loginPage.navigateToLogin()
  await loginPage.login(email, password)
  await loginPage.waitForUrl(/\/?account=/)
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await page.waitForURL(/\/login$/)
}
