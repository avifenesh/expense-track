import { describe, expect, it } from 'vitest'
import { TransactionType, Currency } from '@prisma/client'
import { transactionTypeOptions, typeFilterOptions, currencyOptions } from '@/components/dashboard/tabs/types'

describe('tab shared constants', () => {
  describe('transactionTypeOptions', () => {
    it('has expense and income options', () => {
      expect(transactionTypeOptions).toHaveLength(2)
      expect(transactionTypeOptions.map((o) => o.value)).toContain(TransactionType.EXPENSE)
      expect(transactionTypeOptions.map((o) => o.value)).toContain(TransactionType.INCOME)
    })

    it('has readable labels', () => {
      const expenseOption = transactionTypeOptions.find((o) => o.value === TransactionType.EXPENSE)
      const incomeOption = transactionTypeOptions.find((o) => o.value === TransactionType.INCOME)
      expect(expenseOption?.label).toBe('Expense')
      expect(incomeOption?.label).toBe('Income')
    })
  })

  describe('typeFilterOptions', () => {
    it('includes all types option plus expense and income', () => {
      expect(typeFilterOptions).toHaveLength(3)
      expect(typeFilterOptions[0].value).toBe('all')
      expect(typeFilterOptions[0].label).toBe('All types')
    })

    it('expense and income options match transactionTypeOptions', () => {
      const filterExpense = typeFilterOptions.find((o) => o.value === TransactionType.EXPENSE)
      const filterIncome = typeFilterOptions.find((o) => o.value === TransactionType.INCOME)
      expect(filterExpense?.label).toBe('Expense')
      expect(filterIncome?.label).toBe('Income')
    })
  })

  describe('currencyOptions', () => {
    it('supports USD, EUR, and ILS currencies', () => {
      expect(currencyOptions).toHaveLength(3)
      const values = currencyOptions.map((o) => o.value)
      expect(values).toContain(Currency.USD)
      expect(values).toContain(Currency.EUR)
      expect(values).toContain(Currency.ILS)
    })

    it('has currency symbol in labels', () => {
      const usdOption = currencyOptions.find((o) => o.value === Currency.USD)
      const eurOption = currencyOptions.find((o) => o.value === Currency.EUR)
      const ilsOption = currencyOptions.find((o) => o.value === Currency.ILS)
      expect(usdOption?.label).toContain('$')
      expect(eurOption?.label).toContain('€')
      expect(ilsOption?.label).toContain('₪')
    })
  })
})
