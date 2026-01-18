import { formatCurrency, formatSignedCurrency } from '../../src/utils/format';

describe('formatCurrency', () => {
  describe('USD formatting', () => {
    it('formats whole numbers', () => {
      expect(formatCurrency(100, 'USD')).toBe('$100.00');
    });

    it('formats decimal amounts', () => {
      expect(formatCurrency(99.99, 'USD')).toBe('$99.99');
    });

    it('formats large amounts with commas', () => {
      expect(formatCurrency(1234567.89, 'USD')).toBe('$1,234,567.89');
    });

    it('formats string amounts', () => {
      expect(formatCurrency('50.00', 'USD')).toBe('$50.00');
    });

    it('handles zero', () => {
      expect(formatCurrency(0, 'USD')).toBe('$0.00');
    });

    it('handles negative amounts', () => {
      expect(formatCurrency(-50, 'USD')).toBe('-$50.00');
    });
  });

  describe('EUR formatting', () => {
    it('formats with Euro symbol', () => {
      const result = formatCurrency(100, 'EUR');
      expect(result).toMatch(/€/);
      expect(result).toMatch(/100/);
    });

    it('formats large amounts with proper grouping', () => {
      const result = formatCurrency(1234567.89, 'EUR');
      expect(result).toMatch(/€/);
      expect(result).toMatch(/1.*234.*567/);
    });
  });

  describe('ILS formatting', () => {
    it('formats with Shekel symbol', () => {
      const result = formatCurrency(100, 'ILS');
      expect(result).toMatch(/₪/);
      expect(result).toMatch(/100/);
    });
  });

  describe('edge cases', () => {
    it('defaults to USD when no currency provided', () => {
      expect(formatCurrency(100)).toBe('$100.00');
    });

    it('handles NaN by returning zero', () => {
      expect(formatCurrency(NaN, 'USD')).toBe('$0.00');
    });

    it('handles invalid string amounts', () => {
      expect(formatCurrency('invalid', 'USD')).toBe('$0.00');
    });

    it('handles empty string', () => {
      expect(formatCurrency('', 'USD')).toBe('$0.00');
    });
  });
});

describe('formatSignedCurrency', () => {
  describe('INCOME transactions', () => {
    it('adds + prefix for income', () => {
      expect(formatSignedCurrency(100, 'INCOME', 'USD')).toBe('+$100.00');
    });

    it('formats large income amounts', () => {
      expect(formatSignedCurrency(1000, 'INCOME', 'USD')).toBe('+$1,000.00');
    });

    it('formats income with EUR', () => {
      const result = formatSignedCurrency(100, 'INCOME', 'EUR');
      expect(result).toMatch(/^\+/);
      expect(result).toMatch(/€/);
    });
  });

  describe('EXPENSE transactions', () => {
    it('adds - prefix for expense', () => {
      expect(formatSignedCurrency(50, 'EXPENSE', 'USD')).toBe('-$50.00');
    });

    it('formats large expense amounts', () => {
      expect(formatSignedCurrency(1000, 'EXPENSE', 'USD')).toBe('-$1,000.00');
    });

    it('formats expense with ILS', () => {
      const result = formatSignedCurrency(100, 'EXPENSE', 'ILS');
      expect(result).toMatch(/^-/);
      expect(result).toMatch(/₪/);
    });
  });

  describe('edge cases', () => {
    it('handles zero income', () => {
      expect(formatSignedCurrency(0, 'INCOME', 'USD')).toBe('+$0.00');
    });

    it('handles zero expense', () => {
      expect(formatSignedCurrency(0, 'EXPENSE', 'USD')).toBe('-$0.00');
    });

    it('handles string amounts for income', () => {
      expect(formatSignedCurrency('250.50', 'INCOME', 'USD')).toBe('+$250.50');
    });

    it('handles string amounts for expense', () => {
      expect(formatSignedCurrency('75.25', 'EXPENSE', 'USD')).toBe('-$75.25');
    });

    it('defaults to USD when currency not provided', () => {
      expect(formatSignedCurrency(100, 'INCOME')).toBe('+$100.00');
    });

    it('handles negative amounts for expense (normalizes to absolute)', () => {
      expect(formatSignedCurrency(-50, 'EXPENSE', 'USD')).toBe('-$50.00');
    });

    it('handles negative amounts for income (normalizes to absolute)', () => {
      expect(formatSignedCurrency(-100, 'INCOME', 'USD')).toBe('+$100.00');
    });

    it('handles negative string amounts', () => {
      expect(formatSignedCurrency('-75.25', 'EXPENSE', 'USD')).toBe('-$75.25');
    });
  });
});
