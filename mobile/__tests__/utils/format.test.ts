import { formatCurrency, formatSignedCurrency } from '../../src/utils/format';

describe('format utilities', () => {
  describe('formatCurrency', () => {
    it('formats USD correctly', () => {
      const result = formatCurrency(1234.56, 'USD');

      expect(result).toBe('$1,234.56');
    });

    it('formats EUR correctly', () => {
      const result = formatCurrency(1234.56, 'EUR');

      // EUR formatting may vary by locale implementation
      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toMatch(/€/);
    });

    it('formats ILS correctly', () => {
      const result = formatCurrency(1234.56, 'ILS');

      expect(result).toContain('1');
      expect(result).toContain('234');
      expect(result).toMatch(/₪/);
    });

    it('handles string amount input', () => {
      const result = formatCurrency('1234.56', 'USD');

      expect(result).toBe('$1,234.56');
    });

    it('handles zero amount', () => {
      const result = formatCurrency(0, 'USD');

      expect(result).toBe('$0.00');
    });

    it('handles large amounts', () => {
      const result = formatCurrency(1000000.99, 'USD');

      expect(result).toBe('$1,000,000.99');
    });

    it('handles decimal precision', () => {
      const result = formatCurrency(10.1, 'USD');

      expect(result).toBe('$10.10');
    });

    it('handles negative amounts', () => {
      const result = formatCurrency(-50.25, 'USD');

      // Different environments may format negative currency differently
      // e.g., "-$50.25" or "($50.25)" or "$-50.25"
      expect(result).toContain('50.25');
      expect(result).toContain('$');
    });

    it('defaults to USD when no currency provided', () => {
      const result = formatCurrency(100);

      expect(result).toBe('$100.00');
    });

    it('handles NaN input gracefully', () => {
      const result = formatCurrency('invalid', 'USD');

      expect(result).toBe('$0.00');
    });

    it('handles empty string input', () => {
      const result = formatCurrency('', 'USD');

      expect(result).toBe('$0.00');
    });
  });

  describe('formatSignedCurrency', () => {
    it('adds plus sign for INCOME', () => {
      const result = formatSignedCurrency(100, 'INCOME', 'USD');

      expect(result).toBe('+$100.00');
    });

    it('adds minus sign for EXPENSE', () => {
      const result = formatSignedCurrency(100, 'EXPENSE', 'USD');

      expect(result).toBe('-$100.00');
    });

    it('handles string amounts', () => {
      const result = formatSignedCurrency('250.50', 'INCOME', 'USD');

      expect(result).toBe('+$250.50');
    });

    it('works with different currencies for income', () => {
      const result = formatSignedCurrency(100, 'INCOME', 'EUR');

      expect(result).toMatch(/^\+/);
      expect(result).toMatch(/€/);
    });

    it('works with different currencies for expense', () => {
      const result = formatSignedCurrency(100, 'EXPENSE', 'ILS');

      expect(result).toMatch(/^-/);
      expect(result).toMatch(/₪/);
    });

    it('defaults to USD', () => {
      const result = formatSignedCurrency(100, 'INCOME');

      expect(result).toBe('+$100.00');
    });

    it('handles zero amounts for income', () => {
      const result = formatSignedCurrency(0, 'INCOME', 'USD');

      expect(result).toBe('+$0.00');
    });

    it('handles zero amounts for expense', () => {
      const result = formatSignedCurrency(0, 'EXPENSE', 'USD');

      expect(result).toBe('-$0.00');
    });
  });
});
