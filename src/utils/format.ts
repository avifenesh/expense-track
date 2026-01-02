// Currency type matching Prisma schema enum
type Currency = "USD" | "EUR" | "ILS";

export function formatCurrency(
  value: number,
  currencyCode: Currency | string = "USD"
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatRelativeAmount(
  value: number,
  currencyCode: Currency | string = "USD"
) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
  });
  const formatted = formatter.format(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Format currency with both original and converted amounts if they differ
 * Example: "$100 (₪365.50)" or "€50 ($55.32)"
 */
export function formatCurrencyWithOriginal({
  convertedAmount,
  originalAmount,
  displayCurrency,
  originalCurrency,
}: {
  convertedAmount: number;
  originalAmount: number;
  displayCurrency: Currency;
  originalCurrency: Currency;
}): string {
  const converted = formatCurrency(convertedAmount, displayCurrency);

  // If currencies are the same, just return the converted amount
  if (displayCurrency === originalCurrency) {
    return converted;
  }

  // Show both currencies
  const original = formatCurrency(originalAmount, originalCurrency);
  return `${converted} (${original})`;
}

/**
 * Get compact currency format without decimals for large amounts
 */
export function formatCurrencyCompact(
  value: number,
  currencyCode: Currency | string = "USD"
): string {
  const absValue = Math.abs(value);

  if (absValue >= 1000000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currencyCode,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return formatCurrency(value, currencyCode);
}
