import { expect } from '@playwright/test'
import { BasePage } from './base-page'

export class DashboardPage extends BasePage {
  async navigateToDashboard() {
    await this.goto('/')
    await expect(this.page).toHaveURL(/\/?/)
  }

  async clickSignOut() {
    // Account button may have hidden text on mobile, use aria-controls selector
    const accountButton = this.page.locator('button[aria-controls="settings-menu"]')
    await accountButton.click()

    const signOutButton = this.page.getByRole('menuitem', { name: /sign out/i })
    await signOutButton.click()
  }

  async clickAddTransaction() {
    await this.clickButton('Add Transaction')
  }

  async clickAddHolding() {
    await this.clickButton('Add Holding')
  }

  async expectStatCard(label: string) {
    await expect(this.page.getByText(label)).toBeVisible()
  }

  async expectTransactionsList() {
    await expect(this.getByRole('heading', { name: /transactions/i })).toBeVisible()
  }

  async navigateToTab(tabName: string) {
    await this.page.getByRole('tab', { name: tabName }).click()
  }

  async expectTab(tabName: string) {
    await expect(this.page.getByRole('tab', { name: tabName })).toBeVisible()
  }

  async expectSubscriptionBanner(text: string | RegExp) {
    await expect(this.getByText(text)).toBeVisible()
  }

  async clickUpgrade() {
    await this.page.getByRole('link', { name: /upgrade/i }).click()
  }
}
