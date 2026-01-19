import { expect } from '@playwright/test'
import { BasePage } from './base-page'

export class SharingPage extends BasePage {
  async navigateToSharingTab() {
    await this.page.getByRole('tab', { name: 'Sharing' }).click()
  }

  async clickShareExpense(transactionDescription: string) {
    const row = this.page.locator('tr', { hasText: transactionDescription })
    await row.getByRole('button', { name: /share/i }).click()
  }

  async fillShareExpenseForm(data: {
    splitType?: string
    participantEmails: string[]
    description?: string
    amounts?: number[]
    percentages?: number[]
  }) {
    if (data.splitType) {
      // Use label matching since split type options have labels like 'Split equally'
      await this.selectOption('Split type', { label: data.splitType })
    }

    for (const email of data.participantEmails) {
      const emailInput = this.page.getByPlaceholder('Enter email address')
      await emailInput.fill(email)
      // Button has aria-label="Add participant", not visible text
      const addButton = this.page.getByLabel('Add participant')
      await addButton.click()
      // Wait for participant lookup (async server action) to complete
      await this.page.waitForLoadState('networkidle')
      // Participant card shows email, allow longer timeout for async lookup
      await expect(this.getByText(email)).toBeVisible({ timeout: 10000 })
    }

    if (data.description) {
      await this.fillInput('Note (optional)', data.description)
    }

    if (data.amounts) {
      for (let i = 0; i < data.amounts.length; i++) {
        await this.page.locator(`input[name="amount-${i}"]`).fill(String(data.amounts[i]))
      }
    }

    if (data.percentages) {
      for (let i = 0; i < data.percentages.length; i++) {
        await this.page.locator(`input[name="percentage-${i}"]`).fill(String(data.percentages[i]))
      }
    }
  }

  async submitShareExpense() {
    // Use type="submit" to distinguish from icon buttons with title="Share expense"
    const submitButton = this.page.locator('button[type="submit"]', { hasText: 'Share expense' })
    await submitButton.click()
  }

  async removeParticipant(email: string) {
    const participantRow = this.page.locator('div', { hasText: email })
    // Button has aria-label="Remove participant"
    await participantRow.getByLabel('Remove participant').click()
  }

  async expectSharedExpenseInList(description: string, amount: string) {
    const card = this.page.locator('div', { hasText: 'Expenses I Shared' })
    await expect(card.getByText(description)).toBeVisible()
    await expect(card.getByText(amount)).toBeVisible()
  }

  async expectExpenseSharedWithMeInList(description: string, amount: string) {
    const card = this.page.locator('div', { hasText: 'Expenses Shared With Me' })
    await expect(card.getByText(description)).toBeVisible()
    await expect(card.getByText(amount)).toBeVisible()
  }

  async expectSettlementBalance(person: string, amount: string) {
    const balanceSection = this.page.locator('div', { hasText: 'Settlement Summary' })
    await expect(balanceSection.getByText(person)).toBeVisible()
    await expect(balanceSection.getByText(amount)).toBeVisible()
  }

  async expectNoSharedExpenses() {
    await expect(this.getByText(/no shared expenses/i)).toBeVisible()
  }

  async expectValidationError(message: string) {
    await expect(this.getByText(message)).toBeVisible()
  }

  async expectParticipantAdded(email: string) {
    // Participant lookup is async (server action), allow longer timeout
    await expect(this.getByText(email)).toBeVisible({ timeout: 20000 })
  }
}
