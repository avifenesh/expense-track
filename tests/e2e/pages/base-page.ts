import { Page, Locator, expect } from '@playwright/test'

export class BasePage {
  constructor(protected page: Page) {}

  async goto(path: string) {
    await this.page.goto(path)
  }

  async waitForUrl(pattern: string | RegExp) {
    await expect(this.page).toHaveURL(pattern)
  }

  async clickButton(name: string) {
    await this.page.getByRole('button', { name }).click()
  }

  async fillInput(label: string, value: string) {
    await this.page.getByLabel(label).fill(value)
  }

  async selectOption(label: string, value: string | { label: string }) {
    await this.page.getByLabel(label).selectOption(value)
  }

  async expectText(text: string) {
    await expect(this.page.getByText(text)).toBeVisible()
  }

  async expectNotText(text: string) {
    await expect(this.page.getByText(text)).not.toBeVisible()
  }

  async expectHeading(name: string) {
    await expect(this.page.getByRole('heading', { name })).toBeVisible()
  }

  getByRole(role: Parameters<Page['getByRole']>[0], options?: Parameters<Page['getByRole']>[1]): Locator {
    return this.page.getByRole(role, options)
  }

  getByLabel(label: string): Locator {
    return this.page.getByLabel(label)
  }

  getByText(text: string | RegExp): Locator {
    return this.page.getByText(text)
  }

  getByTestId(testId: string): Locator {
    return this.page.getByTestId(testId)
  }

  async waitForNavigation(url: string | RegExp) {
    await this.page.waitForURL(url)
  }

  async reload() {
    await this.page.reload()
  }

  async goBack() {
    await this.page.goBack()
  }

  currentUrl(): string {
    return this.page.url()
  }

  /**
   * Wait for CSRF token fetch to complete after tab navigation.
   * The CSRF hook fires on component mount and takes ~200-500ms.
   * Using a fixed wait because:
   * - waitForLoadState('networkidle') causes hangs with Next.js persistent connections
   * - waitForResponse may miss the CSRF fetch if it completed before this call
   * - 1000ms provides reliable margin across environments
   */
  async waitForCsrf() {
    await this.page.waitForTimeout(1000)
  }
}
