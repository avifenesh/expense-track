import type { Currency } from '../types';

const currencyFormats: Record<Currency, { locale: string; currency: string }> = {
  USD: { locale: 'en-US', currency: 'USD' },
  EUR: { locale: 'en-EU', currency: 'EUR' },
  ILS: { locale: 'he-IL', currency: 'ILS' },
};

/**
 * Format an amount with currency symbol
 * @param amount - Amount as string or number
 * @param currency - Currency code (USD, EUR, ILS)
 * @returns Formatted string like "$1,234.56" or "€1.234,56" or "₪1,234.56"
 */
export function formatCurrency(
  amount: string | number,
  currency: Currency = 'USD'
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(numAmount)) {
    return formatCurrency(0, currency);
  }

  const format = currencyFormats[currency] || currencyFormats.USD;

  try {
    return new Intl.NumberFormat(format.locale, {
      style: 'currency',
      currency: format.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numAmount);
  } catch {
    // Fallback if Intl.NumberFormat fails
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₪';
    return `${symbol}${numAmount.toFixed(2)}`;
  }
}

/**
 * Format amount with sign prefix for income/expense
 * @param amount - Amount as string or number
 * @param type - 'INCOME' or 'EXPENSE'
 * @param currency - Currency code
 * @returns Formatted string like "+$1,234.56" or "-$1,234.56"
 */
export function formatSignedCurrency(
  amount: string | number,
  type: 'INCOME' | 'EXPENSE',
  currency: Currency = 'USD'
): string {
  const formatted = formatCurrency(amount, currency);
  return type === 'INCOME' ? `+${formatted}` : `-${formatted}`;
}
