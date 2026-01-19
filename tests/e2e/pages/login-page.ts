import { expect } from '@playwright/test'
import { BasePage } from './base-page'

export class LoginPage extends BasePage {
  async navigateToLogin() {
    await this.goto('/login')
    await expect(this.page).toHaveURL(/\/login$/)
  }

  async fillEmail(email: string) {
    await this.fillInput('Email', email)
  }

  async fillPassword(password: string) {
    await this.fillInput('Password', password)
  }

  async clickLogin() {
    await this.clickButton('Enter Balance Beacon')
  }

  async login(email: string, password: string) {
    await this.fillEmail(email)
    await this.fillPassword(password)
    await this.clickLogin()
  }

  async expectInvalidCredentialsError() {
    await expect(this.getByText('Invalid username or password')).toBeVisible()
  }

  async expectRequiredFieldError(field: string) {
    await expect(this.getByText(`${field} is required`)).toBeVisible()
  }

  async clickForgotPassword() {
    await this.page.getByRole('link', { name: /forgot.*password/i }).click()
  }

  async clickSignUp() {
    await this.page.getByRole('link', { name: /sign up/i }).click()
  }

  async expectLoginPage() {
    await expect(this.page).toHaveURL(/\/login$/)
  }
}
