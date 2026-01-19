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
      await this.selectOption('Split type', data.splitType)
    }

    for (const email of data.participantEmails) {
      await this.fillInput('Participant email', email)
      await this.clickButton('Add Participant')
      await expect(this.getByText(email)).toBeVisible()
    }

    if (data.description) {
      await this.fillInput('Description', data.description)
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
    await this.clickButton('Share Expense')
  }

  async removeParticipant(email: string) {
    const participantRow = this.page.locator('div', { hasText: email })
    await participantRow.getByRole('button', { name: /remove/i }).click()
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

  async acceptExpenseRequest(description: string) {
    const card = this.page.locator('div', { hasText: description })
    await card.getByRole('button', { name: /accept/i }).click()
  }

  async rejectExpenseRequest(description: string) {
    const card = this.page.locator('div', { hasText: description })
    await card.getByRole('button', { name: /reject/i }).click()
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
    await expect(this.getByText(email)).toBeVisible()
  }
}
