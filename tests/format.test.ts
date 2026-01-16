import { describe, it, expect } from 'vitest'
import { formatCurrency, formatRelativeAmount } from '@/utils/format'

describe('format.ts', () => {
  describe('formatCurrency()', () => {
    it('should format USD amounts with $ symbol', () => {
      expect(formatCurrency(100, 'USD')).toBe('$100.00')
      expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56')
    })

    it('should format EUR amounts with € symbol', () => {
      expect(formatCurrency(100, 'EUR')).toBe('€100.00')
      expect(formatCurrency(1234.56, 'EUR')).toBe('€1,234.56')
    })

    it('should format ILS amounts with ₪ symbol', () => {
      expect(formatCurrency(100, 'ILS')).toBe('₪100.00')
      expect(formatCurrency(1234.56, 'ILS')).toBe('₪1,234.56')
    })

    it('should default to USD when no currency specified', () => {
      expect(formatCurrency(100)).toBe('$100.00')
    })

    it('should handle zero values', () => {
      expect(formatCurrency(0, 'USD')).toBe('$0.00')
      expect(formatCurrency(0, 'ILS')).toBe('₪0.00')
    })

    it('should handle negative values', () => {
      expect(formatCurrency(-100, 'USD')).toBe('-$100.00')
      expect(formatCurrency(-100, 'ILS')).toBe('-₪100.00')
    })

    it('should round to 2 decimal places', () => {
      expect(formatCurrency(100.999, 'USD')).toBe('$101.00')
      expect(formatCurrency(100.004, 'USD')).toBe('$100.00')
    })
  })

  describe('formatRelativeAmount()', () => {
    it('should format positive USD amounts with + prefix', () => {
      expect(formatRelativeAmount(100, 'USD')).toBe('+$100.00')
      expect(formatRelativeAmount(1234.56, 'USD')).toBe('+$1,234.56')
    })

    it('should format negative USD amounts with - prefix', () => {
      expect(formatRelativeAmount(-100, 'USD')).toBe('-$100.00')
      expect(formatRelativeAmount(-1234.56, 'USD')).toBe('-$1,234.56')
    })

    it('should format zero without sign', () => {
      expect(formatRelativeAmount(0, 'USD')).toBe('$0.00')
    })

    it('should format EUR amounts correctly', () => {
      expect(formatRelativeAmount(100, 'EUR')).toBe('+€100.00')
      expect(formatRelativeAmount(-100, 'EUR')).toBe('-€100.00')
    })

    it('should format ILS amounts correctly', () => {
      expect(formatRelativeAmount(100, 'ILS')).toBe('+₪100.00')
      expect(formatRelativeAmount(-100, 'ILS')).toBe('-₪100.00')
    })

    it('should default to USD when no currency specified', () => {
      expect(formatRelativeAmount(100)).toBe('+$100.00')
      expect(formatRelativeAmount(-100)).toBe('-$100.00')
    })

    it('should handle small amounts', () => {
      expect(formatRelativeAmount(0.01, 'USD')).toBe('+$0.01')
      expect(formatRelativeAmount(-0.01, 'ILS')).toBe('-₪0.01')
    })

    it('should round to 2 decimal places', () => {
      expect(formatRelativeAmount(100.999, 'USD')).toBe('+$101.00')
      expect(formatRelativeAmount(-100.004, 'ILS')).toBe('-₪100.00')
    })
  })

  describe('currency display integration', () => {
    it('should display converted amount in preferred currency (USD to ILS scenario)', () => {
      // User enters $100 USD, exchange rate is 3.6, so 360 ILS
      const convertedAmount = 360
      const preferredCurrency = 'ILS'

      // This is what the transactions-tab now displays
      const displayed = formatRelativeAmount(-convertedAmount, preferredCurrency)
      expect(displayed).toBe('-₪360.00')
    })

    it('should display converted amount in preferred currency (EUR to USD scenario)', () => {
      // User enters €100 EUR, exchange rate is 1.18, so $118 USD
      const convertedAmount = 118
      const preferredCurrency = 'USD'

      const displayed = formatRelativeAmount(convertedAmount, preferredCurrency)
      expect(displayed).toBe('+$118.00')
    })
  })
})
